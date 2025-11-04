// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import { clerkMiddleware } from "@clerk/express";
import userRoutes from "./routes/user.js";
import customizeRoutes from "./routes/customize.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import chalk from "chalk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Queue } from "bullmq"; // ✅ Added BullMQ

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ---------------------------
// 🔴 LOCAL REDIS CONFIGURATION
// ---------------------------
const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  connectTimeout: 30000,
  retryStrategy: (times) => {
    const delay = Math.min(times * 1000, 5000);
    console.log(chalk.yellow(`🔄 Redis retry attempt ${times}, waiting ${delay}ms...`));
    return delay;
  },
  maxRetriesPerRequest: null,
};

// Add password if provided (for local Redis with auth)
if (process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD.trim() !== "") {
  redisConfig.password = process.env.REDIS_PASSWORD;
  console.log(chalk.green("🔐 Using local Redis WITH password authentication"));
} else {
  console.log(chalk.yellow("🔓 Using local Redis WITHOUT password"));
}

console.log(chalk.cyan(`🔗 Connecting to Redis: ${redisConfig.host}:${redisConfig.port}`));

// ---------------------------
// 🔴 INITIALIZE BULLMQ QUEUES
// ---------------------------
export const resumeProcessingQueue = new Queue("resume-processing", {
  connection: redisConfig,
});

export const resumeCustomizationQueue = new Queue("resume-customization", {
  connection: redisConfig,
});

export const linkedInTeaserQueue = new Queue("linkedin-teaser", {
  connection: redisConfig,
});

console.log(chalk.green("✅ All BullMQ queues initialized with local Redis"));

// ---------------------------
// 🔴 REDIS CONNECTION TEST
// ---------------------------
async function testRedisConnection() {
  try {
    const jobCounts = await resumeProcessingQueue.getJobCounts();
    console.log(chalk.green("✅ Redis connection successful!"));
    console.log(chalk.cyan("📊 Resume Processing Queue Status:"), jobCounts);
    return true;
  } catch (err) {
    console.error(chalk.red("❌ Redis connection failed:"), err.message);
    console.error(chalk.yellow("⚠️  Make sure Redis is running: redis-server"));
    return false;
  }
}

// ---------------------------
// 1️⃣ Fix __dirname for ES Modules
// ---------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------
// 2️⃣ Ensure uploads directory exists (local temp)
// ---------------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
console.log(chalk.cyanBright(`📂 Upload directory ready: ${uploadDir}`));

// ---------------------------
// 3️⃣ Middleware Setup
// ---------------------------
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// 🔹 Log CORS origin being used
app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    process.env.FRONTEND_URL || "http://localhost:5173"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ Clerk middleware — must come after JSON parsers
app.use(clerkMiddleware());

// Serve local uploaded files for debugging
app.use("/uploads", express.static(uploadDir));

// ---------------------------
// 4️⃣ Global Debug Middleware
// ---------------------------
app.set("trust proxy", true);
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 8).toUpperCase();

  console.log(
    chalk.gray(
      `\n🔹 [${new Date().toISOString()}] [REQ:${requestId}] ${req.method} ${
        req.originalUrl
      }`
    )
  );

  if (req.body && Object.keys(req.body).length > 0) {
    console.log(chalk.yellowBright("📦 Request Body:"), req.body);
  }

  res.on("finish", () => {
    const ms = Date.now() - start;
    const color =
      res.statusCode < 300
        ? chalk.green
        : res.statusCode < 400
        ? chalk.blue
        : res.statusCode < 500
        ? chalk.yellow
        : chalk.red;
    console.log(color(`🟢 [REQ:${requestId}] Completed → ${res.statusCode} (${ms}ms)`));
  });

  next();
});

// ---------------------------
// 5️⃣ Routes
// ---------------------------
app.use("/user", userRoutes);
app.use("/", customizeRoutes);

// ---------------------------
// 6️⃣ Debug / Health Endpoints
// ---------------------------

// 🔹 Redis Queue Debug (NEW!)
app.get("/debug/redis", async (req, res) => {
  console.log(chalk.blue("🔍 /debug/redis called"));
  
  try {
    const [processingCounts, customizationCounts, teaserCounts] = await Promise.all([
      resumeProcessingQueue.getJobCounts(),
      resumeCustomizationQueue.getJobCounts(),
      linkedInTeaserQueue.getJobCounts(),
    ]);

    res.json({
      status: "✅ Connected",
      connection: {
        host: redisConfig.host,
        port: redisConfig.port,
        hasPassword: !!redisConfig.password,
      },
      queues: {
        "resume-processing": processingCounts,
        "resume-customization": customizationCounts,
        "linkedin-teaser": teaserCounts,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(chalk.red("❌ Redis Debug Failed:"), err.message);
    res.status(500).json({
      status: "❌ Failed",
      error: err.message,
      suggestion: "Make sure Redis is running: redis-server",
    });
  }
});

// 🔹 Gemini & Env Debug
app.get("/debug/gemini", async (req, res) => {
  console.log(chalk.blue("🔍 /debug/gemini called"));
  const geminiKey = process.env.GEMINI_API_KEY;
  let geminiStatus = "❌ Not Connected";

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const models = await genAI.listModels();
    geminiStatus = `✅ Connected (${models?.models?.length || "unknown"} models available)`;
  } catch (err) {
    console.error(chalk.red("❌ Gemini Check Failed:"), err.message);
  }

  res.json({
    geminiKeyLoaded: !!geminiKey,
    geminiStatus,
    mongoURI: process.env.MONGO_URI ? "✅ Loaded" : "❌ Missing",
    redisHost: process.env.REDIS_HOST || "127.0.0.1",
    redisPort: process.env.REDIS_PORT || 6379,
    frontendURL: process.env.FRONTEND_URL,
    timestamp: new Date().toISOString(),
  });
});

// 🔹 Simple CORS Debug
app.get("/debug/cors", (req, res) => {
  res.json({
    ok: true,
    origin: req.headers.origin,
    message: "CORS is working properly ✅",
  });
});

// 🔹 Basic Health Check
app.get("/", (req, res) => {
  console.log(chalk.green("💓 Health check route called"));
  res.json({
    message: "Resume Processing API running ✅",
    version: "1.0.0",
    services: {
      mongodb: mongoose.connection.readyState === 1 ? "✅ Connected" : "❌ Disconnected",
      redis: "✅ Initialized (check /debug/redis for details)",
    },
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------
// 7️⃣ MongoDB Connection
// ---------------------------
console.log(chalk.yellow("⏳ Connecting to MongoDB..."));
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log(chalk.green("✅ MongoDB connected successfully")))
  .catch((err) => {
    console.error(chalk.red("❌ MongoDB connection error:"), err.message);
    process.exit(1);
  });

// ---------------------------
// 8️⃣ Global Error Handler
// ---------------------------
app.use((err, req, res, next) => {
  console.error(chalk.bgRed.white("💥 Global Error:"), err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// ---------------------------
// 9️⃣ Start Server
// ---------------------------
app.listen(PORT, async () => {
  console.log(chalk.magentaBright("\n" + "=".repeat(70)));
  console.log(chalk.greenBright(`🚀 Server running on http://localhost:${PORT}`));
  console.log(chalk.magentaBright("=".repeat(70)));
  
  console.log(chalk.cyan("\n📍 API Endpoints:"));
  console.log(chalk.white(`  ➤ Health check:      http://localhost:${PORT}/`));
  console.log(chalk.white(`  ➤ User sync:         http://localhost:${PORT}/user/sync`));
  console.log(chalk.white(`  ➤ Resume upload:     http://localhost:${PORT}/user/upload`));
  console.log(chalk.white(`  ➤ JD analysis:       http://localhost:${PORT}/user/job-description`));
  console.log(chalk.white(`  ➤ Customize resume:  http://localhost:${PORT}/customize-resume`));
  console.log(chalk.white(`  ➤ Job status:        http://localhost:${PORT}/resume-job-status/:jobId`));
  
  console.log(chalk.cyan("\n🔍 Debug Endpoints:"));
  console.log(chalk.white(`  ➤ Redis status:      http://localhost:${PORT}/debug/redis`));
  console.log(chalk.white(`  ➤ Gemini status:     http://localhost:${PORT}/debug/gemini`));
  console.log(chalk.white(`  ➤ CORS test:         http://localhost:${PORT}/debug/cors`));
  console.log(chalk.white(`  ➤ Static uploads:    http://localhost:${PORT}/uploads/<filename>`));
  
  console.log(chalk.magentaBright("\n" + "=".repeat(70)));
  console.log(chalk.yellowBright("🌍 Environment Configuration:"));
  console.log(chalk.white("  ➤ PORT:"), PORT);
  console.log(chalk.white("  ➤ MONGO_URI:"), process.env.MONGO_URI ? "✅ Loaded" : "❌ Missing");
  console.log(chalk.white("  ➤ GEMINI_API_KEY:"), process.env.GEMINI_API_KEY ? "✅ Loaded" : "❌ Missing");
  console.log(chalk.white("  ➤ REDIS_HOST:"), redisConfig.host);
  console.log(chalk.white("  ➤ REDIS_PORT:"), redisConfig.port);
  console.log(chalk.white("  ➤ REDIS_PASSWORD:"), redisConfig.password ? "✅ Set" : "❌ Not Set");
  console.log(chalk.white("  ➤ FRONTEND_URL:"), process.env.FRONTEND_URL || "http://localhost:5173");
  console.log(chalk.magentaBright("=".repeat(70)));
  
  // Test Redis connection
  console.log(chalk.yellow("\n⏳ Testing Redis connection..."));
  const redisConnected = await testRedisConnection();
  
  if (redisConnected) {
    console.log(chalk.green("✅ All systems operational!\n"));
  } else {
    console.log(chalk.red("⚠️  Redis not connected. Queue operations may fail."));
    console.log(chalk.yellow("💡 Start Redis with: redis-server\n"));
  }
});
