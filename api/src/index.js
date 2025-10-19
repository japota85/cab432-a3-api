import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from one folder above /src
dotenv.config({ path: path.join(__dirname, "../.env"), debug: true });

console.log("DEBUG: .env loaded from", path.join(__dirname, "../.env"));
console.log("DEBUG: COGNITO_USER_POOL_ID =", process.env.COGNITO_USER_POOL_ID);

import express from "express";
import authRoutes from "./routes/authRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";
import pool, { initDB } from "./config/db.js";
import cpuRoutes from "./routes/cpuRoutes.js";
import memcached, { setCache, getCache } from "./config/cacheClient.js";

const app = express();

// Global middleware
app.use(express.json());

// Mount routers
app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/cpu", cpuRoutes);

// Root test route
// Root test route
app.get("/", (_req, res) => {
  res.send("🚀 CAB432 A2 Video API is running!");
});

// Test ElastiCache connection using helper functions
app.get("/test-cache", async (req, res) => {
  const key = "demoKey";
  const value = "Hello from ElastiCache!";
  try {
    await setCache(key, value, 10);
    const result = await getCache(key);
    res.send(`✅ Cache working! Retrieved: ${result}`);
  } catch (err) {
    console.error("Cache test error:", err);
    res.status(500).send("❌ Error testing cache connection");
  }
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await initDB(); // test DB connection
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to initialize DB:", err);
    process.exit(1);
  }
};

startServer();



