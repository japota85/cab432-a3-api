import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuid } from "uuid";
import { requireAuth } from "../middleware/requireAuth.js";
import pool from "../config/db.js";
import { exec } from "child_process";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import s3Client from "../config/s3Client.js";
import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sendJobMessage } from "../utils/sendJobMessage.js";
import { sendToQueue } from "../utils/sendToQueue.js";
import AWS from "aws-sdk";

// (ElastiCache)
import { getCache, setCache } from "../config/cacheClient.js";

const router = express.Router();

// SQS test route

router.post("/test-queue", async (req, res) => {
  try {
    const { videoId = "manual-test", s3Key = "test.mp4", userId = "tester", operation = "transcode" } = req.body;
    const sqs = new AWS.SQS({ region: "ap-southeast-2" });
    console.log("🔍 process.env.SQS_QUEUE_URL =", process.env.SQS_QUEUE_URL);
    const params = {
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify({ videoId, s3Key, userId, operation }),
    };
    await sqs.sendMessage(params).promise();
    console.log("✅ Test message sent to SQS");
    res.status(200).json({ message: "✅ Test message sent to SQS" });
  } catch (error) {
    console.error("❌ SQS Send Error:", error);
    res.status(500).json({ error: error.message });
  }
});


router.use(requireAuth);

const BUCKET_NAME = process.env.S3_BUCKET;

// Detect environment
const isProd = process.env.NODE_ENV === "production";

// ---- ensure ./uploads/raw exists ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAW_DIR = path.join(__dirname, "..", "..", "uploads", "raw");
fs.mkdirSync(RAW_DIR, { recursive: true });

const OUT_DIR = path.join(__dirname, "..", "..", "uploads", "processed");
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---- Multer config ----
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, RAW_DIR),
  filename: (_req, file, cb) => {
    const id = uuid();
    const ext = path.extname(file.originalname || "");
    cb(null, `${id}${ext || ".mp4"}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ok = /^video\//.test(file.mimetype);
  cb(ok ? null : new Error("Only video files are allowed"), ok);
};

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 200);
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

// ---- Routes ----

// POST /api/videos/upload  (protected)
router.post("/upload", requireAuth, upload.single("video"), async (req, res) => {
  try {
    const file = req.file;

    const safeId = uuid();
    const rawKey = `raw/${safeId}.mp4`;
    const processedKey = `processed/${safeId}.mp4`;

    // 1️⃣ Upload original to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: rawKey,
      Body: fs.createReadStream(file.path),
      ContentType: file.mimetype,
    }));

    // 2️⃣ Process with ffmpeg
    const processedPath = path.join(OUT_DIR, `${safeId}.mp4`);
    await new Promise((resolve, reject) => {
      const cmd = `ffmpeg -i "${file.path}" -vf scale=640:-1 -c:v libx264 -preset fast -crf 28 -c:a aac "${processedPath}" -y`;

      console.log("[ffmpeg] Starting processing...");
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error("[ffmpeg] Error:", stderr);
          return reject(error);
        }
        console.log("[ffmpeg] Finished processing");
        resolve();
      });
    });

    // 3️⃣ Upload processed to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: processedKey,
      Body: fs.createReadStream(processedPath),
      ContentType: "video/mp4",
    }));

    await sendToQueue({
      filename: file.originalname,
      user_id: req.user.id,
      action: "PROCESS_VIDEO",
      timestamp: new Date().toISOString(),
    });

    await sendJobMessage(safeId, processedKey, req.user.username);

    // 4️⃣ Clean up
    try { fs.unlinkSync(file.path); } catch {}
    try { fs.unlinkSync(processedPath); } catch {}

    // 5️⃣ Save metadata in RDS
    const { rows } = await pool.query(
      `INSERT INTO videos (id, s3_key, original_name, mime, size, owner_sub)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        safeId,
        processedKey,
        file.originalname,
        "video/mp4",
        file.size,
        req.user?.sub || null,
      ]
    );

    res.json({
      message: "Upload & processing successful!",
      video: rows[0],
    });
  } catch (err) {
    console.error("[videos] upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ✅ GET /videos (cached)
router.get("/", async (req, res) => {
  try {
    const { sub } = req.user;
    const cacheKey = `videos:list:${sub}`;

    // 1️⃣ Try ElastiCache (production)
    if (isProd) {
      const cached = await getCache(cacheKey);
      if (cached) {
        console.log("📦 Cache hit (ElastiCache)");
        return res.json(JSON.parse(cached));
      }
    }

    // 2️⃣ Fallback to RDS
    const { rows } = await pool.query(
      "SELECT id, s3_key, original_name, mime, size, uploaded_at FROM videos WHERE owner_sub = $1 ORDER BY uploaded_at DESC",
      [sub]
    );

    // 3️⃣ Save cache
    if (isProd) await setCache(cacheKey, JSON.stringify(rows), 30);

    console.log("💾 Cache miss → DB queried");
    res.json(rows);
  } catch (err) {
    console.error("[videos] list error:", err);
    res.status(500).json({ error: "Failed to list videos" });
  }
});

export default router;
