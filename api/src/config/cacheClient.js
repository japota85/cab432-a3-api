import Memcached from "memcached";

let memcached;
try {
  const host = process.env.MEMCACHED_HOST;
  const port = process.env.MEMCACHED_PORT;
  const endpoint = `${host}:${port}`;
  memcached = new Memcached(endpoint, { retries: 2, retry: 2000, timeout: 2000 });
  console.log(`✅ Memcached client configured: ${endpoint}`);
} catch (err) {
  console.error("❌ Failed to connect to ElastiCache. Falling back to local mock cache.", err);
  memcached = {
    store: {},
    set: (key, val, ttl, cb) => {
      memcached.store[key] = val;
      setTimeout(() => delete memcached.store[key], ttl * 1000);
      cb && cb(null);
    },
    get: (key, cb) => cb(null, memcached.store[key]),
  };
}

export default memcached;
