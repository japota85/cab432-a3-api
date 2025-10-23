import { CognitoJwtVerifier } from "aws-jwt-verify";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// ✅ Load .env file from the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

// ✅ Safe log
console.log("requireAuth: loaded .env, pool =", process.env.COGNITO_USER_POOL_ID);

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID,
});

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ error: "Missing token" });

    const token = authHeader.split(" ")[1];
    const payload = await verifier.verify(token);
    req.user = payload;
    next();
  } catch (err) {
    console.error("❌ Auth verification failed:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
