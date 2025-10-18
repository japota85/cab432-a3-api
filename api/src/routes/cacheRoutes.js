// api/src/routes/cacheRoutes.js
const express = require("express");
const router = express.Router();
const { setCache, getCache, delCache, endpoint } = require("../config/memcachedClient");

// Health check: show where the API thinks Memcached is
router.get("/health", (req, res) => {
  res.json({
    ok: true,
    endpoint,
    host: process.env.MEMCACHED_HOST,
    port: process.env.MEMCACHED_PORT,
  });
});

// Simple set/get demo
router.get("/test", async (req, res) => {
  try {
    const key = "testKey";
    const value = "CAB432_A3_Working";
    await setCache(key, value, 60);
    const roundTrip = await getCache(key);
    res.json({ ok: true, key, value: roundTrip });
  } catch (err) {
    console.error("cache/test error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Delete demo key (optional)
router.delete("/test", async (req, res) => {
  try {
    const removed = await delCache("testKey");
    res.json({ ok: true, removed });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
