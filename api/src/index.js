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

const app = express();

// Global middleware
app.use(express.json());

// Mount routers
app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/cpu", cpuRoutes);

// Root test route
app.get("/", (_req, res) => {
  res.send("🚀 CAB432 A2 Video API is running!");
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await initDB(); // test DB connection
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to initialize DB:", err);
    process.exit(1);
  }
};

startServer();


