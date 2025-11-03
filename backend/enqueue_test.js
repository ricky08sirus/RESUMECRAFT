// enqueue-test.js
import { resumeQueue, customizationQueue, incrEnqueued } from "./queue.js";

async function run() {
  console.log("Enqueueing a test resume-processing job...");
  const p1 = await resumeQueue.add("test-process", { fileKey: "test.pdf", jobId: "test-job-1", fileName: "test.pdf" });
  incrEnqueued("resume-processing", "test-process");
  console.log("-> enqueued:", p1.id);

  console.log("Enqueueing a test customization job...");
  const p2 = await customizationQueue.add("customize", {
    userId: "dev-user",
    resumeId: "someResumeId",
    jobDescription: "This is a test job description with lots of keywords for frontend engineering.",
    jobId: "test-custom-1",
  });
  incrEnqueued("resume-customization", "customize");
  console.log("-> enqueued:", p2.id);
  process.exit(0);
}

run().catch(err => {
  console.error("enqueue-test error:", err);
  process.exit(1);
});
