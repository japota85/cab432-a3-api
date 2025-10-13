import bcrypt from "bcrypt";
import pool from "../src/config/db.js";

if (process.argv.length < 4) {
  console.error("Usage: node hashAndSetPassword.js <email> <plainPassword>");
  process.exit(1);
}

const email = process.argv[2];
const plain = process.argv[3];

async function run() {
  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(plain, saltRounds);

    const res = await pool.query(
      "UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email",
      [hash, email]
    );

    if (res.rowCount === 0) {
      console.log("No user updated — user not found. Insert a user first.");
    } else {
      console.log("Password updated for:", res.rows[0]);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
