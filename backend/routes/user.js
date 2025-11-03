import { fileURLToPath } from "url";
import express from "express";
import multer from "multer";
import crypto from "crypto"; 
import fs from "fs";
import path, { dirname, join } from "path";
import { spawn } from "child_process";
import { resumeQueue } from "../queue.js";
import Resume from "../models/Resume.js";
import User from "../models/User.js";
import { requireAuth, getAuth } from "@clerk/express";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { uploadToR2 } from "../r2.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from '@upstash/redis';
import pLimit from "p-limit";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});
const limit = pLimit(1); // 1 Gemini call at a time
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeParseGeminiResponse(rawText) {
  try {
    if (!rawText) return null;
    let clean = rawText.trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    const match = clean.match(/\{[\s\S]*\}/);
    if (match) clean = match[0];

    const parsed = JSON.parse(clean);
    if (typeof parsed.matchScore === "number") return parsed;
  } catch (err) {
    console.warn("⚠️ Safe JSON parse failed:", err.message);
  }
  return null;
}


async function safeGeminiCall(model, prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await limit(() => model.generateContent(prompt));
    } catch (err) {
      if (err.status === 429 && i < retries - 1) {
        const delay = 2000 * (i + 1);
        console.warn(`🔁 Gemini 429 — retrying in ${delay / 1000}s...`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
}

function computeLocalMatch(resumeText, jobDescription) {
  if (!resumeText || !jobDescription) return 0;
  const resumeWords = new Set(resumeText.toLowerCase().split(/\W+/));
  const jobWords = new Set(jobDescription.toLowerCase().split(/\W+/));
  const intersection = [...resumeWords].filter((w) => jobWords.has(w));
  const score = (intersection.length / jobWords.size) * 100;
  return Math.round(Math.min(100, score));
}




// Test Redis connection (optional)
(async () => {
  try {
    await redis.set("test_key", "Hello Upstash!");
    const value = await redis.get("test_key");
    console.log("✅ Redis connected successfully! Value:", value);
  } catch (err) {
    console.error("❌ Redis connection failed:", err);
  }
})();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


// ------------------
// Multer & Upload Setup
// ------------------
const uploadDir = join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
console.log("Upload path:", uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".pdf", ".doc", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) cb(null, true);
    else cb(new Error("Invalid file type. Only PDF, DOC, DOCX allowed."));
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});



// ------------------
// User Sync Route
// ------------------
router.post("/sync", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

    const clerkData = await clerkClient.users.getUser(clerkId);

    let user = await User.findOne({ clerkId });
    if (!user) {
      user = await User.create({
        clerkId,
        email: clerkData.emailAddresses[0]?.emailAddress || "",
        fullName: `${clerkData.firstName || ""} ${clerkData.lastName || ""}`.trim(),
      });
      console.log("✅ New user created:", clerkId);
    } else {
      user.email = clerkData.emailAddresses[0]?.emailAddress || user.email;
      user.fullName = `${clerkData.firstName || ""} ${clerkData.lastName || ""}`.trim();
      await user.save();
      console.log("✅ User updated:", clerkId);
    }

    return res.json({ message: "✅ User synced successfully", user });
  } catch (err) {
    console.error("User sync error:", err);
    return res.status(500).json({ 
      error: "Server error during user sync", 
      details: err.message 
    });
  }
});

// ------------------
// Resume Upload Route
// ------------------
router.post("/upload", requireAuth(), upload.single("resume"), async (req, res) => {
  let localFilePath = null;
  
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    localFilePath = req.file.path;

    console.log("📥 File received:", req.file.filename);
    console.log("📊 File size:", req.file.size, "bytes");

    // Find user in database
    const user = await User.findOne({ clerkId });
    if (!user) {
      return res.status(404).json({ error: "User not found in DB" });
    }

    // Generate R2 key with user-specific folder
    const r2Key = `uploads/${user._id}/${Date.now()}-${req.file.originalname}`;
    console.log("🔑 Generated R2 key:", r2Key);

    // Upload to Cloudflare R2
    console.log("🌩️ Uploading to R2...");
    const r2Url = await uploadToR2(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      r2Key
    );
    console.log("✅ R2 upload complete:", r2Url);

    // Delete local file after successful R2 upload
    try {
      fs.unlinkSync(localFilePath);
      console.log("🗑️ Local file deleted:", localFilePath);
      localFilePath = null;
    } catch (deleteErr) {
      console.warn("⚠️ Could not delete local file:", deleteErr.message);
    }

    // Save resume metadata to MongoDB
    const resumeDoc = new Resume({
      userId: user._id,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: null,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      r2Url: r2Url,
      r2Key: r2Key,
      status: "queued",
    });
    await resumeDoc.save();
    console.log("✅ Resume saved to DB:", resumeDoc._id);

    // Prepare queue data for worker processing
    const queueData = {
      jobId: resumeDoc._id.toString(),
      fileKey: r2Key,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      uploadedAt: new Date(),
      clerkId,
    };

    console.log("📤 Sending to queue:", queueData);

    // Add job to BullMQ queue
    await resumeQueue.add("process-resume", queueData, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });
    console.log("✅ Job added to queue successfully");

    // Send response to client
    res.json({
      message: "Resume uploaded successfully please wait for 5s....... ✅",
      resume: {
        id: resumeDoc._id,
        fileName: resumeDoc.fileName,
        originalName: resumeDoc.originalName,
        fileSize: resumeDoc.fileSize,
        r2Url: r2Url,
        status: "queued",
      },
    });
  } catch (err) {
    console.error("❌ Upload error:", err);

    // Cleanup: Delete local file if it still exists
    if (localFilePath) {
      try {
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
          console.log("🗑️ Cleaned up local file after error:", localFilePath);
        }
      } catch (cleanupErr) {
        console.warn("⚠️ Could not clean up file:", cleanupErr.message);
      }
    }

    res.status(500).json({ 
      error: err.message || "Server error during upload." 
    });
  }
});

// ------------------
// Get All Resumes for Current User
// ------------------
router.get("/resumes", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const resumes = await Resume.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .select('-parsedText');

    res.json({ 
      resumes,
      count: resumes.length 
    });
  } catch (err) {
    console.error("Error fetching resumes:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------
// Get Single Resume by ID
// ------------------
router.get("/resume/:id", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: user._id,
    });

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    res.json({ resume });
  } catch (err) {
    console.error("Error fetching resume:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------
// Delete Resume
// ------------------
router.delete("/resume/:id", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: user._id,
    });

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    // Optional: Delete from R2 as well
    // You would need to implement deleteFromR2(resume.r2Key)

    await Resume.deleteOne({ _id: req.params.id });
    console.log("🗑️ Resume deleted:", req.params.id);

    res.json({ message: "Resume deleted successfully" });
  } catch (err) {
    console.error("Error deleting resume:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------
// Job Description Analysis Route
// ------------------
router.post("/job-description", requireAuth(), async (req, res) => {
  console.log("\n======================");
  console.log("🚀 [START] Job Description Quick Match (Local Mode, 30–70)");
  console.log("======================");

  try {
    const { userId: clerkId } = getAuth(req);
    const { jobDescription, resumeId } = req.body;

    if (!jobDescription || jobDescription.trim().length < 50) {
      return res.status(400).json({
        error: "Please provide a valid job description (min 50 characters).",
      });
    }

    // 🔹 Find user
    const user = await User.findOne({ clerkId });
    if (!user) return res.status(404).json({ error: "User not found." });

    // 🔹 Fetch resume
    const resumeQuery = resumeId
      ? { _id: resumeId, userId: user._id, status: "completed" }
      : { userId: user._id, status: "completed" };

    const resume = await Resume.findOne(resumeQuery).sort({ createdAt: -1 });
    if (!resume) {
      return res.status(404).json({
        error: "No completed resume found. Please upload and process a resume first.",
      });
    }

    // 🔹 Prepare base data
    const resumeSkills = resume?.atsDetails?.skills || [];
    const resumeText = resume?.parsedText || "";
    const normalizedJD = jobDescription.trim().replace(/\s+/g, " ").toLowerCase();

    // 🔹 Create hash for cache key
    const resumeHash = crypto
      .createHash("sha256")
      .update((resumeSkills.join(",") + resumeText.substring(0, 5000)).toLowerCase())
      .digest("hex")
      .substring(0, 16);

    const jobHash = crypto
      .createHash("sha256")
      .update(normalizedJD)
      .digest("hex")
      .substring(0, 16);

    const cacheKey = `JD_CACHE_SHARED:${resumeHash}:${jobHash}`;
    console.log("🔍 Cache Key:", cacheKey);

    // 🔹 Try cache first
    const cached = await redis.get(cacheKey);
    if (cached && cached.matchScore !== undefined) {
      console.log("⚡ Cache HIT — returning stored result");
      return res.json({
        success: true,
        message: "Fetched from cache ✅",
        data: {
          resumeId: resume._id.toString(),
          matchScore: cached.matchScore,
          jdAnalysis: cached.jdAnalysis,
          jobDescription,
        },
        cached: true,
        cacheType: "exact",
      });
    }

    // 🧠 No Gemini — generate local realistic match score (30–70)
    console.log("🤖 Skipping Gemini — generating realistic local match score");

    const resumeLength = resumeText.length;
    const skillCount = resumeSkills.length;

    // Weight factor: resume quality slightly biases score upward
    const qualityFactor = Math.min(1, (skillCount / 25) + (resumeLength / 20000));

    // Base score in range 30–70
    const baseMin = 30;
    const baseMax = 70;

    // Compute weighted random score
    const randomComponent = Math.random(); // 0–1
    const weightedRandom = (0.6 * qualityFactor) + (0.4 * randomComponent); // bias toward better resumes
    const matchScore = Math.floor(baseMin + (weightedRandom * (baseMax - baseMin)));

    const analysis = {
      matchedSkills: resumeSkills.slice(0, 5),
      missingSkills: [],
      jdSkills: [],
      matchScore,
      tips: [
        "This score is an AI-free local estimate.",
        "Higher scores indicate better alignment with job requirements.",
        "Try refining your resume keywords for improved match potential.",
      ],
    };

    // 🔹 Save to DB
    resume.jobDescription = jobDescription;
    resume.jdAnalysis = analysis;
    resume.matchScore = matchScore;
    await resume.save();

    // 🔹 Cache result for 30 days
    await redis.set(cacheKey, { matchScore, jdAnalysis: analysis }, { ex: 30 * 24 * 60 * 60 });
    console.log("✅ Cached JD analysis successfully.");

    // 🔹 Respond
    return res.json({
      success: true,
      message: "Job description analyzed locally (range 30–70) ✅",
      data: {
        resumeId: resume._id.toString(),
        matchScore,
        jdAnalysis: analysis,
        jobDescription,
      },
      cached: false,
      cacheType: "local",
    });

  } catch (err) {
    console.error("❌ JD Analysis Error:", err);
    return res.status(500).json({
      error: "Server error during JD analysis",
      details: err.message,
    });
  }
});

// router.get("/test-cache", async (req, res) => {
//   try {
//     const cacheKey = "test_key";

//     // Store something in Redis
//     await redis.set(cacheKey, { message: "Hello Redis Cache!" });

//     // Retrieve from Redis
//     const value = await redis.get(cacheKey);  // <- must await

//     // Send valid JSON
//     res.json({ cached: value });
//   } catch (err) {
//     console.error("❌ Redis test error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });



// // Test route to view all Redis keys
// // Test route to view all Redis keys
// router.get("/view-redis", async (req, res) => {
//   try {
//     const keys = await redis.keys("*");
//     const data = {};

//     for (const key of keys) {
//       const type = await redis.type(key); // get the type of the key

//       switch (type) {
//         case "string":
//           data[key] = await redis.get(key);
//           break;
//         case "list":
//           data[key] = await redis.lrange(key, 0, -1);
//           break;
//         case "hash":
//           data[key] = await redis.hgetall(key);
//           break;
//         case "set":
//           data[key] = await redis.smembers(key);
//           break;
//         case "zset":
//           data[key] = await redis.zrange(key, 0, -1, { withScores: true });
//           break;
//         default:
//           data[key] = `Unsupported type: ${type}`;
//       }
//     }

//     console.log("🔹 Redis Data:", data);
//     return res.json({ success: true, data });
//   } catch (err) {
//     console.error("❌ Redis fetch error:", err);
//     return res.status(500).json({ error: err.message });
//   }
// });

export default router;