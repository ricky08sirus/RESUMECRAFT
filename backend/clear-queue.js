// clear-queue.js
import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

const queue = new Queue('resume-processing', {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    tls: {},
  }
});

async function clearQueue() {
  try {
    console.log("🧹 Clearing all jobs from queue...");
    
    // Remove all jobs
    await queue.drain();
    await queue.clean(0, 1000, 'completed');
    await queue.clean(0, 1000, 'failed');
    await queue.clean(0, 1000, 'active');
    await queue.clean(0, 1000, 'delayed');
    await queue.clean(0, 1000, 'wait');
    
    console.log("✅ Queue cleared successfully!");
    
    const counts = await queue.getJobCounts();
    console.log("📊 Job counts:", counts);
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error clearing queue:", err);
    process.exit(1);
  }
}

clearQueue();