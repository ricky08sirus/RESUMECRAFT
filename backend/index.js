// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import { clerkMiddleware } from "@clerk/express";
import userRoutes from "./routes/user.js"; // includes /upload, /sync, /job-description
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import chalk from "chalk";
import { GoogleGenerativeAI } from "@google/generative-ai"; // ✅ Added Gemini connectivity check
import customizeRoutes from "./routes/customize.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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
app.use("/", customizeRoutes);  // ✅ FIXED: Register without /user prefix

// ---------------------------
// 6️⃣ Debug / Health Endpoints
// ---------------------------

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
  console.log(chalk.magentaBright("\n--------------------------------------------------------------"));
  console.log(chalk.greenBright(`🚀 Server running on http://localhost:${PORT}`));
  console.log(chalk.cyan(`🩵 Health check:`), `http://localhost:${PORT}/`);
  console.log(chalk.cyan(`📬 User sync:`), `http://localhost:${PORT}/user/sync`);
  console.log(chalk.cyan(`📤 Resume upload:`), `http://localhost:${PORT}/user/upload`);
  console.log(chalk.cyan(`🧠 JD analysis:`), `http://localhost:${PORT}/user/job-description`);
  console.log(chalk.cyan(`✨ Customize resume:`), `http://localhost:${PORT}/customize-resume`);  // ✅ Added
  console.log(chalk.cyan(`📊 Job status:`), `http://localhost:${PORT}/resume-job-status/:jobId`);  // ✅ Added
  console.log(chalk.cyan(`🧩 Gemini debug:`), `http://localhost:${PORT}/debug/gemini`);
  console.log(chalk.cyan(`📁 Static uploads:`), `http://localhost:${PORT}/uploads/<filename>`);
  console.log(chalk.magentaBright("--------------------------------------------------------------"));
  console.log(chalk.yellowBright("🌍 Environment Debug:"));
  console.log("  ➤ PORT:", PORT);
  console.log("  ➤ MONGO_URI:", process.env.MONGO_URI ? "✅ Loaded" : "❌ Missing");
  console.log("  ➤ GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "✅ Loaded" : "❌ Missing");
  console.log("  ➤ FRONTEND_URL:", process.env.FRONTEND_URL || "http://localhost:5173");
  console.log(chalk.magentaBright("--------------------------------------------------------------\n"));
});
