// queue.js - Ultra-Scalable Version
import { Queue, QueueEvents } from "bullmq";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

/* ------------------------- MongoDB Connection ------------------------- */
mongoose
  .connect(process.env.MONGO_URI, {
    maxPoolSize: 50,           // Increase connection pool
    minPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("✅ MongoDB connected (Queue) with connection pooling"))
  .catch((err) => {
    console.error("❌ MongoDB error:", err.message);
    process.exit(1);
  });

/* --------------------------- Redis Configuration --------------------------- */
const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  connectTimeout: 30000,
  retryStrategy: (times) => {
    const delay = Math.min(times * 1000, 5000);
    console.log(`🔄 Redis retry attempt ${times}, waiting ${delay}ms...`);
    return delay;
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  lazyConnect: false,
};

if (process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD.trim() !== "") {
  redisConfig.password = process.env.REDIS_PASSWORD;
  redisConfig.tls = { rejectUnauthorized: false };
  console.log("📍 Using cloud Redis with TLS");
} else {
  console.log("📍 Using local Redis without auth");
}

console.log(`🔗 Connecting to Redis: ${redisConfig.host}:${redisConfig.port}`);

/* --------------------------- Default Queue Options --------------------------- */
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  removeOnComplete: {
    age: 3600,      // Keep completed jobs for 1 hour
    count: 1000,    // Keep last 1000 completed jobs
  },
  removeOnFail: {
    age: 7200,      // Keep failed jobs for 2 hours
    count: 5000,    // Keep last 5000 failed jobs for debugging
  },
};

/* --------------------------- Queue Initialization --------------------------- */

// 🧾 Queue 1: Resume file uploads / parsing
export const resumeQueue = new Queue("resume-processing", {
  connection: redisConfig,
  defaultJobOptions,
});

// 🎨 Queue 2: Job description customization
export const customizationQueue = new Queue("resume-customization", {
  connection: redisConfig,
  defaultJobOptions,
});

// 💬 Queue 3: LinkedIn reach-out message generation
export const linkedInTeaserQueue = new Queue("linkedin-teaser", {
  connection: redisConfig,
  defaultJobOptions,
});

/* --------------------------- Queue Events for Monitoring --------------------------- */
function setupQueueEvents(queue, name, color = "🟢") {
  queue.on("ready", () => console.log(`${color} ${name} ready and connected!`));
  queue.on("error", (err) => console.error(`❌ ${name} error:`, err.message));
  queue.on("waiting", (jobId) => console.log(`⏳ ${name} - Job ${jobId} waiting...`));
  queue.on("active", (job) => console.log(`⚙️ ${name} - Job ${job.id} active`));
  queue.on("completed", (job) => console.log(`✅ ${name} - Job ${job.id} completed`));
  queue.on("failed", (job, err) => console.error(`❌ ${name} - Job ${job?.id} failed: ${err.message}`));
  queue.on("stalled", (jobId) => console.warn(`⚠️ ${name} - Job ${jobId} stalled`));
  queue.on("paused", () => console.log(`⏸️ ${name} paused`));
  queue.on("resumed", () => console.log(`▶️ ${name} resumed`));
}

setupQueueEvents(resumeQueue, "Resume Queue", "📄");
setupQueueEvents(customizationQueue, "Customization Queue", "✨");
setupQueueEvents(linkedInTeaserQueue, "LinkedIn Teaser Queue", "💬");

/* --------------------------- QueueEvents for Real-time Monitoring --------------------------- */
const resumeEvents = new QueueEvents("resume-processing", { connection: redisConfig });
const customizationEvents = new QueueEvents("resume-customization", { connection: redisConfig });
const linkedInEvents = new QueueEvents("linkedin-teaser", { connection: redisConfig });

resumeEvents.on("completed", ({ jobId }) => {
  console.log(`✅ [EVENT] Resume processing job ${jobId} completed`);
});

customizationEvents.on("completed", ({ jobId }) => {
  console.log(`✅ [EVENT] Customization job ${jobId} completed`);
});

linkedInEvents.on("completed", ({ jobId }) => {
  console.log(`✅ [EVENT] LinkedIn teaser job ${jobId} completed`);
});

/* --------------------------- Health Check Helper --------------------------- */
export async function getQueuesHealth() {
  try {
    const [resumeCounts, customizationCounts, linkedInCounts] = await Promise.all([
      resumeQueue.getJobCounts(),
      customizationQueue.getJobCounts(),
      linkedInTeaserQueue.getJobCounts(),
    ]);

    return {
      resumeQueue: resumeCounts,
      customizationQueue: customizationCounts,
      linkedInTeaserQueue: linkedInCounts,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("❌ Health check failed:", err.message);
    return { error: err.message };
  }
}

/* --------------------------- Graceful Shutdown --------------------------- */
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, closing queues gracefully...");
  await Promise.all([
    resumeQueue.close(),
    customizationQueue.close(),
    linkedInTeaserQueue.close(),
    resumeEvents.close(),
    customizationEvents.close(),
    linkedInEvents.close(),
  ]);
  console.log("✅ All queues closed");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received, closing queues gracefully...");
  await Promise.all([
    resumeQueue.close(),
    customizationQueue.close(),
    linkedInTeaserQueue.close(),
    resumeEvents.close(),
    customizationEvents.close(),
    linkedInEvents.close(),
  ]);
  console.log("✅ All queues closed");
  process.exit(0);
});

/* --------------------------- Startup Logs --------------------------- */
console.log("\n" + "=".repeat(70));
console.log("🚀 ULTRA-SCALABLE QUEUE SYSTEM INITIALIZED");
console.log("📦 Available queues:");
console.log("   1. resume-processing (Resume uploads & parsing)");
console.log("   2. resume-customization (AI job matching)");
console.log("   3. linkedin-teaser (LinkedIn reach-out messages)");
console.log("🛡️  Features:");
console.log("   • Auto-retry with exponential backoff");
console.log("   • Connection pooling (50 MongoDB connections)");
console.log("   • Job retention policies");
console.log("   • Real-time event monitoring");
console.log("   • Graceful shutdown handling");
console.log("=".repeat(70) + "\n");

/* --------------------------- Periodic Health Check (Optional) --------------------------- */
setInterval(async () => {
  const health = await getQueuesHealth();
  if (!health.error) {
    console.log("\n📊 Queue Health Check:");
    console.log(`   Resume Queue: ${JSON.stringify(health.resumeQueue)}`);
    console.log(`   Customization Queue: ${JSON.stringify(health.customizationQueue)}`);
    console.log(`   LinkedIn Queue: ${JSON.stringify(health.linkedInTeaserQueue)}`);
  }
}, 300000); // Every 5 minutes

export default { resumeQueue, customizationQueue, linkedInTeaserQueue };