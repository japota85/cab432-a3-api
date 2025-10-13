import crypto from "crypto";

const seconds = Number(process.argv[2] || 60);
const until = Date.now() + seconds * 1000;

let iterations = 0;

// PBKDF2 is CPU-heavy and deterministic;
while (Date.now() < until) {
  crypto.pbkdf2Sync("demo-password", "demo-salt", 250000, 64, "sha512");
  iterations++;
}

console.log(
  JSON.stringify({
    done: true,
    seconds,
    iterations
  })
);

// Exit with success (so parent knows we finished)
process.exit(0);
