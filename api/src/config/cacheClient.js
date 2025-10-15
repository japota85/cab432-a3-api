import Memcached from "memcached";

const memcached = new Memcached(
  `${process.env.MEMCACHED_HOST}:${process.env.MEMCACHED_PORT}`,
  { retries: 10, retry: 10000, remove: true }
);

memcached.on("issue", (details) => {
  console.error("⚠️  Memcached issue:", details);
});

memcached.on("failure", (details) => {
  console.error("❌ Memcached server failed:", details.server);
});

memcached.on("reconnecting", (details) => {
  console.log("🔄 Reconnecting to Memcached:", details.server);
});

memcached.on("reconnect", (details) => {
  console.log("✅ Reconnected to Memcached:", details.server);
});

console.log("✅ Memcached client configured:", process.env.MEMCACHED_HOST);

export default memcached;
