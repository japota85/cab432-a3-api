import Memcached from "memcached";

// Declare global client reference
let memcached;

try {
  const host = process.env.MEMCACHED_HOST;
  const port = process.env.MEMCACHED_PORT || 11211;

  if (!host) throw new Error("MEMCACHED_HOST not set in environment variables.");

  const endpoint = `${host}:${port}`;
  memcached = new Memcached(endpoint, { retries: 2, retry: 2000, timeout: 2000 });

  console.log(`✅ Memcached client configured: ${endpoint}`);

  // Optional: quick connectivity test (non-blocking)
  memcached.stats((err, stats) => {
    if (err) {
      console.warn("⚠️ Could not fetch Memcached stats:", err.message);
    } else {
      console.log("📡 Memcached is reachable, cluster responding.");
    }
  });
} catch (err) {
  console.error("❌ Failed to connect to ElastiCache. Falling back to local mock cache.", err);

  // Fallback local mock cache (in-memory)
  memcached = {
    store: {},
    set: (key, val, ttl, cb) => {
      memcached.store[key] = val;
      setTimeout(() => delete memcached.store[key], ttl * 1000);
      cb && cb(null);
    },
    get: (key, cb) => cb(null, memcached.store[key]),
    del: (key, cb) => {
      delete memcached.store[key];
      cb && cb(null);
    },
    end: () => console.log("Mock cache closed."),
  };
}

// Export functions for reuse
export const setCache = (key, value, ttl = 60) =>
  new Promise((resolve, reject) => {
    memcached.set(key, value, ttl, (err) => (err ? reject(err) : resolve(true)));
  });

export const getCache = (key) =>
  new Promise((resolve, reject) => {
    memcached.get(key, (err, data) => (err ? reject(err) : resolve(data)));
  });

export const delCache = (key) =>
  new Promise((resolve, reject) => {
    memcached.del(key, (err) => (err ? reject(err) : resolve(true)));
  });

export const shutdownCache = () => {
  memcached.end && memcached.end();
  console.log("🛑 Memcached client closed.");
};

// Default export (for backwards compatibility)
export default memcached;
