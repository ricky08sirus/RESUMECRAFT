// r2.js
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a file to Cloudflare R2.
 * 
 * @param {string} filePath - Local path to the file.
 * @param {string} fileName - Original filename.
 * @param {string} mimeType - File MIME type.
 * @param {string} [customKey] - Optional custom key for object storage.
 * @returns {string} Public R2 URL of uploaded file.
 */
export const uploadToR2 = async (filePath, fileName, mimeType, customKey) => {
  const fileData = fs.readFileSync(filePath);

  // ✅ Allow caller to specify a custom key (fallback to auto-generated)
  const key = customKey || `uploads/${Date.now()}-${fileName}`;

  const params = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: fileData,
    ContentType: mimeType,
  };

  const command = new PutObjectCommand(params);
  await r2.send(command);

  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${key}`;
};
