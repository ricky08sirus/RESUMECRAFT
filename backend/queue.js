// queue.js — Ultra-Scalable BullMQ v5 Configuration
import { Queue, QueueEvents } from "bullmq";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

/* ------------------------- MongoDB Connection ------------------------- */
mongoose
  .connect(process.env.MONGO_URI, {
    maxPoolSize: 50,
    minPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("✅ MongoDB connected (Queue) with connection pooling"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

/* --------------------------- Redis Configuration --------------------------- */
const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password:
    process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD.trim() !== ""
      ? process.env.REDIS_PASSWORD
      : undefined,
  connectTimeout: 10000,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  lazyConnect: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 1000, 5000);
    console.warn(`🔄 Redis retry attempt ${times}, waiting ${delay}ms...`);
    return delay;
  },
};

console.log(`🔗 Connecting to Redis → ${redisConfig.host}:${redisConfig.port}`);
if (redisConfig.password) console.log("🔐 Using local Redis with password authentication");
else console.log("📍 Using local Redis without authentication");

/* --------------------------- Default Job Options --------------------------- */
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 7200, count: 5000 },
};

/* --------------------------- Queue Initialization --------------------------- */
export const resumeQueue = new Queue("resume-processing", {
  connection: redisConfig,
  defaultJobOptions,
});

export const customizationQueue = new Queue("resume-customization", {
  connection: redisConfig,
  defaultJobOptions,
});

export const linkedInTeaserQueue = new Queue("linkedin-teaser", {
  connection: redisConfig,
  defaultJobOptions,
});

/* --------------------------- Queue Monitoring --------------------------- */
function setupQueueEvents(queue, name) {
  queue.on("error", (err) => console.error(`❌ ${name} error:`, err.message));
  queue.on("waiting", (jobId) => console.log(`⏳ ${name} - Job ${jobId} waiting`));
  queue.on("active", (job) => console.log(`⚙️ ${name} - Job ${job.id} active`));
  queue.on("completed", (job) => console.log(`✅ ${name} - Job ${job.id} completed`));
  queue.on("failed", (job, err) =>
    console.error(`❌ ${name} - Job ${job?.id} failed: ${err.message}`)
  );
  queue.on("stalled", (jobId) => console.warn(`⚠️ ${name} - Job ${jobId} stalled`));
}

setupQueueEvents(resumeQueue, "Resume Queue");
setupQueueEvents(customizationQueue, "Customization Queue");
setupQueueEvents(linkedInTeaserQueue, "LinkedIn Teaser Queue");

/* --------------------------- Async QueueEvents Setup --------------------------- */
async function setupQueueEventListeners() {
  const resumeEvents = new QueueEvents("resume-processing", { connection: redisConfig });
  const customizationEvents = new QueueEvents("resume-customization", { connection: redisConfig });
  const linkedInEvents = new QueueEvents("linkedin-teaser", { connection: redisConfig });

  // Wait until ready (fixes ETIMEDOUT issue)
  await Promise.all([
    resumeEvents.waitUntilReady(),
    customizationEvents.waitUntilReady(),
    linkedInEvents.waitUntilReady(),
  ]);

  console.log("✅ All Redis QueueEvents connections ready!");

  // Event listeners
  resumeEvents.on("completed", ({ jobId }) =>
    console.log(`📄 [EVENT] Resume job ${jobId} completed`)
  );
  customizationEvents.on("completed", ({ jobId }) =>
    console.log(`✨ [EVENT] Customization job ${jobId} completed`)
  );
  linkedInEvents.on("completed", ({ jobId }) =>
    console.log(`💬 [EVENT] LinkedIn teaser job ${jobId} completed`)
  );

  return { resumeEvents, customizationEvents, linkedInEvents };
}

let resumeEvents, customizationEvents, linkedInEvents;
setupQueueEventListeners()
  .then((events) => {
    resumeEvents = events.resumeEvents;
    customizationEvents = events.customizationEvents;
    linkedInEvents = events.linkedInEvents;
  })
  .catch((err) => console.error("❌ Failed to initialize QueueEvents:", err.message));

/* --------------------------- Health Check --------------------------- */
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
async function closeAll() {
  console.log("🛑 Closing queues gracefully...");
  try {
    await Promise.all([
      resumeQueue.close(),
      customizationQueue.close(),
      linkedInTeaserQueue.close(),
      resumeEvents?.close(),
      customizationEvents?.close(),
      linkedInEvents?.close(),
    ]);
    console.log("✅ All queues closed successfully!");
  } catch (err) {
    console.error("⚠️ Error during queue shutdown:", err.message);
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", closeAll);
process.on("SIGINT", closeAll);

/* --------------------------- Startup Logs --------------------------- */
console.log("\n" + "=".repeat(70));
console.log("🚀 ULTRA-SCALABLE QUEUE SYSTEM INITIALIZED");
console.log("📦 Queues: resume-processing, resume-customization, linkedin-teaser");
console.log("🛡️ Features: retries, pooling, health check, graceful shutdown");
console.log("=".repeat(70) + "\n");

/* --------------------------- Periodic Health Check --------------------------- */
setInterval(async () => {
  const health = await getQueuesHealth();
  if (!health.error) {
    console.log("\n📊 Queue Health Check:");
    console.log(JSON.stringify(health, null, 2));
  }
}, 300000); // every 5 minutes

export default { resumeQueue, customizationQueue, linkedInTeaserQueue };

