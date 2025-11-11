// worker.js
import { Worker } from "bullmq";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { r2 } from "./r2.js";
import Resume from "./models/Resume.js";
import Tesseract from "tesseract.js";
import fs from "fs";
import path from "path";
import os from "os";
import mammoth from "mammoth";
import textract from "textract";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { createRequire } from "module";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Bottleneck from "bottleneck";

dotenv.config();

const require = createRequire(import.meta.url);
const execPromise = promisify(exec);

/* -------------------------------------------------------------------------- */
/*                               MongoDB Setup                                */
/* -------------------------------------------------------------------------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected (Worker)"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

/* -------------------------------------------------------------------------- */
/*                               Redis Config                                 */
/* -------------------------------------------------------------------------- */
const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  connectTimeout: 30000,
  retryStrategy: (times) => {
    const delay = Math.min(times * 1000, 5000);
    console.log(`🔄 Worker Redis retry attempt ${times}, waiting ${delay}ms...`);
    return delay;
  },
  maxRetriesPerRequest: null,
};

// Add password if provided (for local Redis with auth)
if (process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD.trim() !== "") {
  redisConfig.password = process.env.REDIS_PASSWORD;
  console.log("🔐 Worker using local Redis WITH password authentication");
} else {
  console.log("🔓 Worker using local Redis WITHOUT password");
}

// Remove TLS for local Redis (only needed for cloud services like Upstash)
// TLS is now disabled for local Redis connection

console.log(`🔗 Worker connecting to Redis: ${redisConfig.host}:${redisConfig.port}`);/* -------------------------------------------------------------------------- */
/*                           NLP Extraction Helper                            */
/* -------------------------------------------------------------------------- */
async function runNLPExtraction(resumeText) {
  return new Promise((resolve) => {
    console.log("\n" + "=".repeat(70));
    console.log("🤖 STARTING NLP EXTRACTION USING DOCKER CONTAINER");
    console.log("=".repeat(70));

    const python = spawn("docker", ["run", "-i", "resume-nlp"]);
    let data = "";
    let error = "";

    python.stdout.on("data", (chunk) => {
      const output = chunk.toString();
      data += output;
      console.log("🐍 [STDOUT]:", output.trim());
    });

    python.stderr.on("data", (chunk) => {
      const errOutput = chunk.toString();
      error += errOutput;
      console.error("🐍 [STDERR]:", errOutput.trim());
    });

    python.on("close", (code) => {
      console.log(`🐍 Docker NLP exited with code ${code}`);
      if (code !== 0) {
        return resolve({ skipped: true, reason: "Docker NLP failed", stderr: error });
      }

      try {
        const jsonMatch = data.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in output");
        resolve(JSON.parse(jsonMatch[0]));
      } catch (parseErr) {
        console.warn("⚠️ Failed to parse NLP JSON:", parseErr.message);
        resolve({
          skipped: true,
          reason: "Invalid JSON output",
          raw: data.substring(0, 500),
        });
      }
    });

    python.stdin.write(resumeText);
    python.stdin.end();
  });
}

/* -------------------------------------------------------------------------- */
/*                           Text Extraction Helpers                          */
/* -------------------------------------------------------------------------- */
async function extractFromPDF(fileBuffer, tempFilePath) {
  try {
    const { stdout } = await execPromise(`pdftotext "${tempFilePath}" -`);
    if (stdout && stdout.trim().length > 100) {
      console.log("✅ Extracted PDF via pdftotext");
      return { text: stdout, method: "pdftotext" };
    }
  } catch {
    console.warn("⚠️ pdftotext failed, trying pdf-parse...");
  }

  const pdfParse = require("pdf-parse");
  const pdfData = await pdfParse(fileBuffer);
  if (pdfData.text.trim().length > 100) {
    console.log("✅ Extracted PDF via pdf-parse");
    return { text: pdfData.text, method: "pdf-parse" };
  }

  console.log("🖼️ Using OCR for scanned PDF...");
  const { data: { text } } = await Tesseract.recognize(tempFilePath, "eng");
  if (text.trim().length < 50) throw new Error("OCR produced insufficient text");
  return { text, method: "ocr" };
}

async function extractFromDOCX(fileBuffer) {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  if (!result.value.trim()) throw new Error("Empty DOCX file");
  return { text: result.value, method: "mammoth" };
}

async function extractFromDOC(tempFilePath) {
  return new Promise((resolve, reject) => {
    textract.fromFileWithPath(tempFilePath, { preserveLineBreaks: true }, (err, text) => {
      if (err) return reject(err);
      if (!text.trim()) return reject(new Error("Empty DOC file"));
      resolve({ text, method: "textract" });
    });
  });
}

async function extractText(fileBuffer, fileName, tempFilePath) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".pdf":
      return extractFromPDF(fileBuffer, tempFilePath);
    case ".docx":
      return extractFromDOCX(fileBuffer);
    case ".doc":
      return extractFromDOC(tempFilePath);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

function cleanText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\t+/g, " ")
    .replace(/  +/g, " ")
    .replace(/[^\x20-\x7E\n]/g, "")
    .trim();
}

/* -------------------------------------------------------------------------- */
/*                            Basic ATS Analyzer                              */
/* -------------------------------------------------------------------------- */
function analyzeResume(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

  const analysis = {
    hasEmail: emailRegex.test(text),
    hasPhone: phoneRegex.test(text),
    hasLinkedIn: /linkedin\.com\/in\//i.test(text),
    hasGitHub: /github\.com\//i.test(text),
    hasSections: {
      experience: /\bexperience|employment|work history\b/i.test(text),
      education: /\beducation|degree|academic\b/i.test(text),
      skills: /\bskills|expertise|technologies\b/i.test(text),
      projects: /\bprojects|portfolio|samples\b/i.test(text),
    },
    wordCount: text.split(/\s+/).length,
    characterCount: text.length,
  };

  let score = 0;
  if (analysis.hasEmail) score += 15;
  if (analysis.hasPhone) score += 10;
  if (analysis.hasLinkedIn) score += 10;
  if (analysis.hasGitHub) score += 10;
  if (analysis.hasSections.experience) score += 20;
  if (analysis.hasSections.education) score += 15;
  if (analysis.hasSections.skills) score += 15;
  if (analysis.hasSections.projects) score += 5;
  analysis.atsScore = score;

  return analysis;
}

/* -------------------------------------------------------------------------- */
/*                        Worker 1: Resume Processing                         */
/* -------------------------------------------------------------------------- */
const resumeProcessingWorker = new Worker(
  "resume-processing",
  async (job) => {
    const { fileKey, jobId, fileName } = job.data;
    let tempFilePath = null;

    console.log(`\n📄 [PROCESSING] Starting job ${job.id} for file: ${fileName}`);

    try {
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileKey,
      });
      const response = await r2.send(command);
      const fileBuffer = Buffer.from(await response.Body.transformToByteArray());

      await Resume.updateOne(
        { _id: jobId },
        { status: "processing", processingStartedAt: new Date() }
      );

      tempFilePath = path.join(os.tmpdir(), `resume-${Date.now()}-${fileName}`);
      fs.writeFileSync(tempFilePath, fileBuffer);

      const extractionResult = await extractText(fileBuffer, fileName, tempFilePath);
      const cleanedText = cleanText(extractionResult.text);

      const nlpResult = await runNLPExtraction(cleanedText);
      const analysis = analyzeResume(cleanedText);

      await Resume.updateOne(
        { _id: jobId },
        {
          status: "completed",
          parsedText: cleanedText,
          extractionMethod: extractionResult.method,
          atsScore: analysis.atsScore,
          atsDetails: analysis,
          nlpData: nlpResult && !nlpResult.skipped ? nlpResult : null,
          processedAt: new Date(),
        }
      );

      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      console.log(`✅ [PROCESSING] Completed job ${job.id}`);
      return { jobId, atsScore: analysis.atsScore, nlp: !nlpResult.skipped };
    } catch (err) {
      console.error(`❌ [PROCESSING] Failed job ${job.id}:`, err.message);
      if (jobId)
        await Resume.updateOne(
          { _id: jobId },
          { status: "failed", error: err.message }
        );
      if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      throw err;
    }
  },
  { connection: redisConfig, concurrency: 2 }
);

/* -------------------------------------------------------------------------- */
/*                     Worker 2: AI Resume Customization                      */
/* -------------------------------------------------------------------------- */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

/* -------------------------------------------------------------------------- */
/*                   Ultra-Scalable Rate Limiter with Backoff                 */
/* -------------------------------------------------------------------------- */
const limiter = new Bottleneck({
  minTime: 1000,
  maxConcurrent: 1,
  reservoir: 10,
  reservoirRefreshAmount: 10,
  reservoirRefreshInterval: 60 * 1000,
});

limiter.on("failed", async (error, jobInfo) => {
  const is429 = error.status === 429 || error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");
  
  if (is429 && jobInfo.retryCount < 5) {
    const delay = Math.min(60000, Math.pow(2, jobInfo.retryCount) * 2000);
    console.warn(`⚠️ Rate limit hit. Retry ${jobInfo.retryCount + 1}/5 in ${delay}ms`);
    return delay;
  }
  
  if (jobInfo.retryCount < 3) {
    console.warn(`⚠️ Job failed. Retry ${jobInfo.retryCount + 1}/3 in 3s`);
    return 3000;
  }
});

/* -------------------------------------------------------------------------- */
/*              Ultra-Safe Gemini Requester with Exponential Backoff          */
/* -------------------------------------------------------------------------- */
async function safeGenerateContent(model, prompt, retries = 7) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`🧠 Gemini API attempt ${attempt + 1}/${retries}`);
      const result = await model.generateContent(prompt);
      console.log(`✅ Gemini API success on attempt ${attempt + 1}`);
      return result;
    } catch (err) {
      const is429 = err.status === 429 || 
                    err.message?.includes("429") || 
                    err.message?.includes("RESOURCE_EXHAUSTED") ||
                    err.message?.includes("quota");
      
      const is503 = err.status === 503 || err.message?.includes("503");
      
      if ((is429 || is503) && attempt < retries - 1) {
        const baseDelay = is429 ? 5000 : 2000;
        const delay = Math.min(120000, baseDelay * Math.pow(2, attempt) + Math.random() * 1000);
        console.warn(`⚠️ ${is429 ? 'Rate limit' : 'Service unavailable'} (${err.status}). Waiting ${(delay/1000).toFixed(1)}s before retry ${attempt + 2}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      console.error(`❌ Gemini API error (attempt ${attempt + 1}/${retries}):`, err.message);
      
      if (attempt === retries - 1) {
        throw new Error(`Gemini API failed after ${retries} attempts: ${err.message}`);
      }
    }
  }
  
  throw new Error("Exceeded maximum retry attempts");
}

/* -------------------------------------------------------------------------- */
/*                              Log Header Helper                             */
/* -------------------------------------------------------------------------- */
function logHeader(job, message) {
  console.log("\n" + "=".repeat(70));
  console.log(`🎯 [CUSTOMIZATION] ${message}`);
  console.log(`📦 Job ID: ${job.id}`);
  console.log(`🔖 Custom ID: ${job.data.jobId}`);
  console.log(`👤 User: ${job.data.userId}`);
  console.log(`📄 Resume: ${job.data.resumeId}`);
  console.log("=".repeat(70));
}

/* -------------------------------------------------------------------------- */
/*                        Resume Customization Worker                         */
/* -------------------------------------------------------------------------- */
export const resumeCustomizationWorker = new Worker(
  "resume-customization",
  async (job) => {
    const { userId, resumeId, jobDescription, jobId } = job.data;

    logHeader(job, "Starting new customization job");

    try {
      const resume = await Resume.findById(resumeId);
      if (!resume) throw new Error(`Resume not found in DB: ${resumeId}`);

      if (!resume.parsedText || resume.parsedText.trim().length < 50)
        throw new Error("Parsed resume text is too short or empty");

      const safeResumeText = (resume.parsedText || "").substring(0, 4000);
      const safeJobDescription = (jobDescription || "No job description provided").substring(0, 2000);

      const prompt = `
You are an expert AI career assistant and ATS optimization specialist.
Tailor the resume below to perfectly match the job description.
Ensure keyword optimization, modern phrasing, and ATS compliance.
Keep the same structure and format, only improve the content.

RESUME:
${safeResumeText}

JOB DESCRIPTION:
${safeJobDescription}

Respond ONLY with the improved resume text. Do not add any explanations.
      `.trim();

      console.log("🧠 Sending customization prompt to Gemini...");
      console.time("⏱️ Gemini customization time");

      const result = await limiter.schedule(() => safeGenerateContent(model, prompt));

      console.timeEnd("⏱️ Gemini customization time");

      const improvedResume = result.response.text()?.trim();
      if (!improvedResume) throw new Error("Gemini returned empty response");

      console.log(`📝 Generated improved resume (${improvedResume.length} chars)`);

      console.log("📊 Generating match analysis...");

      const safeAnalysisResume = improvedResume.substring(0, 2500);
      const safeAnalysisJobDesc = (jobDescription || "No job description provided").substring(0, 1500);

      const analysisPrompt = `
Analyze this resume against the job description. Provide scores and brief summary.

RESUME (first 2500 chars):
${safeAnalysisResume}

JOB DESCRIPTION (first 1500 chars):
${safeAnalysisJobDesc}

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "matchScore": <number 0-100>,
  "shortlistChance": <number 0-100>,
  "analysisSummary": "<2-3 sentences>"
}
      `.trim();

      console.time("⏱️ Gemini analysis time");
      const analysisResult = await limiter.schedule(() => safeGenerateContent(model, analysisPrompt));
      console.timeEnd("⏱️ Gemini analysis time");

      let matchScore = null;
      let shortlistChance = null;
      let analysisSummary = null;

      try {
        const analysisText = analysisResult.response.text()?.trim() || "";
        console.log("📊 Raw analysis response:", analysisText.substring(0, 200));

        const cleanedText = analysisText
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();

        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          matchScore = typeof analysis.matchScore === "number" ? analysis.matchScore : null;
          shortlistChance = typeof analysis.shortlistChance === "number" ? analysis.shortlistChance : null;
          analysisSummary = analysis.analysisSummary || null;
          console.log(`✅ Analysis: Score=${matchScore}, Chance=${shortlistChance}`);
        } else {
          console.warn("⚠️ No JSON found in analysis response");
        }
      } catch (parseErr) {
        console.warn("⚠️ Failed to parse analysis:", parseErr.message);
      }

      resume.customizedVersions = resume.customizedVersions || [];
      resume.customizedVersions.push({
        jobId,
        jobDescription: jobDescription || "No job description provided",
        customizedText: improvedResume,
        matchScore,
        shortlistChance,
        analysisSummary,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await resume.save();
      console.log(`💾 Saved customization for job ${jobId}`);
      console.log(`📊 Final scores - Match: ${matchScore}, Shortlist: ${shortlistChance}`);

      return { success: true, resumeId, jobId, matchScore, shortlistChance };
    } catch (err) {
      console.error(`💥 Job ${jobId} failed: ${err.message}`);

      try {
        const resume = await Resume.findById(resumeId);
        if (resume) {
          resume.customizedVersions = resume.customizedVersions || [];
          resume.customizedVersions.push({
            jobId,
            jobDescription: jobDescription || "No job description provided",
            error: err.message,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          await resume.save();
          console.log(`⚠️ Error recorded in DB for job ${jobId}`);
        }
      } catch (saveErr) {
        console.error("❌ Failed to record error in DB:", saveErr.message);
      }

      throw err;
    }
  },
  {
    connection: redisConfig,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 2000,
    },
    settings: {
      backoffStrategies: {
        exponential: (attemptsMade) =>
          Math.min(120000, 2000 * Math.pow(2, attemptsMade)),
      },
    },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 7200 },
  }
);

/* -------------------------------------------------------------------------- */
/*                   Worker 3: LinkedIn Reach-Out Message Generator           */
/* -------------------------------------------------------------------------- */
export const linkedInTeaserWorker = new Worker(
  "linkedin-teaser",
  async (job) => {
    const { userId, resumeId, resumeText, jobId } = job.data;

    console.log("\n" + "=".repeat(70));
    console.log(`💬 [LINKEDIN-TEASER] Starting job ${job.id}`);
    console.log(`📦 Job ID: ${jobId}`);
    console.log(`👤 User: ${userId}`);
    console.log(`📄 Resume: ${resumeId}`);
    console.log("=".repeat(70));

    try {
      if (!resumeText || typeof resumeText !== "string" || resumeText.trim().length < 50) {
        throw new Error("Resume text is too short or not provided");
      }

      const resume = await Resume.findById(resumeId);
      if (!resume) throw new Error(`Resume not found: ${resumeId}`);

      const safeResumeText = resumeText.substring(0, 2000);

      const prompt = `
You are an expert career coach and LinkedIn messaging specialist.

Create a professional, engaging, and personalized LinkedIn reach-out message that a job seeker can use to contact a recruiter or hiring manager.

The message should:
- Be 3-4 sentences long (150-200 words max)
- Start with a compelling hook that references their background
- Highlight 2-3 key relevant skills or experiences
- Express genuine interest in opportunities
- Include a clear call-to-action
- Sound natural, confident, and professional (not robotic)
- Be ready to copy-paste (no placeholders like [Your Name])

RESUME SUMMARY:
${safeResumeText}

Create the LinkedIn reach-out message now. Return ONLY the message text, no explanations or labels.
      `.trim();

      console.log("💬 Generating LinkedIn reach-out message...");
      console.time("⏱️ LinkedIn message generation time");

      const result = await limiter.schedule(() => safeGenerateContent(model, prompt));

      console.timeEnd("⏱️ LinkedIn message generation time");

      const reachOutMessage = result?.response?.text?.()?.trim();
      if (!reachOutMessage) throw new Error("Gemini returned empty message");

      console.log(`✅ Generated reach-out message (${reachOutMessage.length} chars)`);

      // ✅ FIXED: Direct database save instead of addTeaser method
      resume.teasers = resume.teasers || [];
      resume.teasers.push({
        jobId,
        message: reachOutMessage,
        createdAt: new Date(),
      });

      await resume.save();
      console.log(`💾 Saved LinkedIn teaser for job ${jobId}`);

      return { success: true, resumeId, jobId, messageLength: reachOutMessage.length };

    } catch (err) {
      console.error(`💥 LinkedIn teaser job ${jobId} failed: ${err.message}`);

      try {
        const resume = await Resume.findById(resumeId);
        if (resume) {
          resume.teasers = resume.teasers || [];
          resume.teasers.push({
            jobId,
            error: err.message,
            createdAt: new Date(),
          });
          await resume.save();
          console.log(`⚠️ Error recorded for LinkedIn teaser ${jobId}`);
        }
      } catch (saveErr) {
        console.error("❌ Failed to record teaser error:", saveErr.message);
      }

      throw err;
    }
  },
  {
    connection: redisConfig,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 2000,
    },
    settings: {
      backoffStrategies: {
        exponential: (attemptsMade) => Math.min(120000, 2000 * Math.pow(2, attemptsMade)),
      },
    },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 7200 },
  }
);

/* -------------------------------------------------------------------------- */
/*                         Worker Lifecycle Events                            */
/* -------------------------------------------------------------------------- */
resumeProcessingWorker.on("ready", () => console.log("🚀 Resume Processing Worker ready"));
resumeProcessingWorker.on("active", (job) => console.log(`⚙️ Processing job → ${job.id}`));
resumeProcessingWorker.on("completed", (job) => console.log(`✅ Processing completed → ${job.id}`));
resumeProcessingWorker.on("failed", (job, err) => console.error(`❌ Processing failed → ${job.id}: ${err.message}`));

resumeCustomizationWorker.on("ready", () => console.log("🚀 Customization Worker ready and scalable"));
resumeCustomizationWorker.on("active", (job) => console.log(`⚙️ Customization job → ${job.id}`));
resumeCustomizationWorker.on("completed", (job) => console.log(`✅ Customization completed → ${job.id}`));
resumeCustomizationWorker.on("failed", (job, err) => console.error(`❌ Customization failed → ${job.id}: ${err.message}`));
resumeCustomizationWorker.on("stalled", (jobId) => console.warn(`⚠️ Job stalled: ${jobId}`));

linkedInTeaserWorker.on("ready", () => console.log("🚀 LinkedIn Teaser Worker ready"));
linkedInTeaserWorker.on("active", (job) => console.log(`💬 LinkedIn teaser job → ${job.id}`));
linkedInTeaserWorker.on("completed", (job) => console.log(`✅ LinkedIn teaser completed → ${job.id}`));
linkedInTeaserWorker.on("failed", (job, err) => console.error(`❌ LinkedIn teaser failed → ${job.id}: ${err.message}`));

/* -------------------------------------------------------------------------- */
/*                              Startup Logs                                  */
/* -------------------------------------------------------------------------- */
console.log("\n" + "=".repeat(70));
console.log("🚀 ULTRA-SCALABLE WORKERS INITIALIZED");
console.log("📦 Resume Processing Worker: READY");
console.log("✨ Resume Customization Worker: READY (Rate-Limited & Fault-Tolerant)");
console.log("💬 LinkedIn Reach-Out Message Worker: READY");
console.log("🛡️  Features: Exponential backoff, auto-retry, 429 handling");
console.log("=".repeat(70) + "\n");

/* -------------------------------------------------------------------------- */
/*                         Queue Connectivity Test                            */
/* -------------------------------------------------------------------------- */
setTimeout(async () => {
  console.log("🧪 Testing queue connections...");
  try {
    const { Queue } = await import("bullmq");
    const testQueue = new Queue("resume-customization", { connection: redisConfig });
    const counts = await testQueue.getJobCounts();
    console.log("✅ Customization Queue connected! Job counts:", counts);
    await testQueue.close();
  } catch (err) {
    console.error("❌ Queue connection test failed:", err.message);
  }
}, 3000);
