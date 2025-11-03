import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

const queue = new Queue("resume-processing", {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    tls: {},
  },
});

async function addTestJob() {
  const job = await queue.add("test-job", {
  fileName: "test-resume.pdf",
  filePath: "./uploads/test-resume.pdf",
  uploadedAt: new Date(),
  });


  console.log("✅ Test job added:", job.id);
  await queue.close();
}

addTestJob();

