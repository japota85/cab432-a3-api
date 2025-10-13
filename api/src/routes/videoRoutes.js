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
import { s3Client } from "../config/s3Client.js";
import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import redis from "../config/redisClient.js";
import { sendJobMessage } from "../utils/sendJobMessage.js";

const router = express.Router();

router.use(requireAuth);

const BUCKET_NAME = process.env.S3_BUCKET;

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
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

// ---- Routes ----

// POST /api/videos/upload  (protected)
router.post("/upload", requireAuth, upload.single("video"), async (req, res) => {
  try {
    const file = req.file;

    // generate a safe UUID-based key, always .mp4
    const safeId = uuid();
    const rawKey = `raw/${safeId}.mp4`;
    const processedKey = `processed/${safeId}.mp4`;

    // 1. Upload original to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: rawKey,
      Body: fs.createReadStream(file.path),
      ContentType: file.mimetype
    }));

    // 2. Process with ffmpeg
    const processedPath = path.join(OUT_DIR, `${safeId}.mp4`);
    await new Promise((resolve, reject) => {
      const cmd = `ffmpeg -i "${file.path}" -vf scale=640:-1 -c:v libx264 -preset fast -crf 28 -c:a aac "${processedPath}" -y`;

      console.log("[ffmpeg] Starting processing...");
      console.log("[ffmpeg] Command:", cmd);

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error("[ffmpeg] Error:", error);
          console.error("[ffmpeg] Stderr:", stderr);
          return reject(error);
        }
        console.log("[ffmpeg] Stdout:", stdout);
        console.log("[ffmpeg] Stderr:", stderr);
        console.log("[ffmpeg] Finished processing");
        console.log("[ffmpeg] Stderr:", stderr.toString());
        resolve();
      });
    });

    // 3. Upload processed to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: processedKey,
      Body: fs.createReadStream(processedPath),
      ContentType: "video/mp4"
    }));
    
    await sendJobMessage(newVideo.id, s3Key, req.user.username);
    
    // 4. Clean up local
    try { fs.unlinkSync(file.path); } catch (_) {}
    try { fs.unlinkSync(processedPath); } catch (_) {}

    // 5. Save metadata in RDS
    const { rows } = await pool.query(
      `INSERT INTO videos (id, s3_key, original_name, mime, size, owner_sub)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        safeId,                 // id matches UUID key
        processedKey,           // processed S3 key
        file.originalname,      // keep human-friendly name
        "video/mp4",            // mime
        file.size,              // size in bytes
        req.user?.sub || null   // Cognito subject
      ]
    );

    // 6. Respond
    res.json({
      message: "Upload & processing successful!",
      video: rows[0]
    });

  } catch (err) {
    console.error("[videos] upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// GET /videos - List all videos from RDS (with Redis cache)
router.get("/", async (req, res) => {
  try {
    const { sub } = req.user;

    const cacheKey = `videos:list:${sub}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("📦 Cache hit for /videos");
      return res.json(JSON.parse(cached));
    }

    const { rows } = await pool.query(
      "SELECT id, s3_key, original_name, mime, size, uploaded_at FROM videos WHERE owner_sub = $1 ORDER BY uploaded_at DESC",
      [sub]
    );

    await redis.set(cacheKey, JSON.stringify(rows), "EX", 30);

    res.json(rows);
  } catch (err) {
    console.error("[videos] list error:", err);
    res.status(500).json({ error: "Failed to list videos" });
  }
});

// GET /api/videos/:key - Generate a pre-signed URL for download
router.get(/^\/raw\/(.+)$/, async (req, res) => {
  const key = req.params[0]; // capture group from regex
  console.log("Download request for key:", key);

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: `raw/${key}`
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    res.json({ downloadUrl: url });
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Failed to generate download URL" });
  }
});

// GET /videos/:id/stream - Get presigned S3 URL for playback
router.get("/:id/stream", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Look up in RDS
    const { rows } = await pool.query("SELECT s3_key FROM videos WHERE id = $1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Video not found" });
    }

    const s3Key = rows[0].s3_key;

    // 2. Generate presigned URL
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // 3. Send back the presigned URL
    res.json({ url });
  } catch (err) {
    console.error("[videos] stream error:", err);
    res.status(500).json({ error: "Failed to generate stream URL" });
  }
});

// DELETE /api/videos/:id  (protected)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Look up the video in RDS
    const { rows } = await pool.query(
      "SELECT s3_key FROM videos WHERE id = $1",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Video not found" });
    }
    const s3Key = rows[0].s3_key;

    // 2. Delete from S3
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key,
      })
    );

    // 3. Delete from RDS
    await pool.query("DELETE FROM videos WHERE id = $1", [id]);

    res.json({ message: `Video ${id} deleted successfully` });
  } catch (err) {
    console.error("[videos] delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// PUT /api/videos/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { original_name } = req.body;

    if (!original_name) {
      return res.status(400).json({ error: "original_name is required" });
    }

    const { rows } = await pool.query(
      `UPDATE videos 
       SET original_name = $1
       WHERE id = $2
       RETURNING id, s3_key, original_name, mime, size, uploaded_at`,
      [original_name, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json({ message: "Video updated successfully", video: rows[0] });
  } catch (err) {
    console.error("[videos] update error:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

export default router;
