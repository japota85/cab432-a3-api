import { CognitoJwtVerifier } from "aws-jwt-verify";
import dotenv from "dotenv";

// Load .env — safe to include here too, ensures vars exist
dotenv.config({ path: "./.env" });

// Declare verifier here (outside function) — will be created once and reused
let verifier;

export async function requireAuth(req, res, next) {
  try {
    // Initialize the verifier only once (lazy load)
    if (!verifier) {
      verifier = CognitoJwtVerifier.create({
        userPoolId: process.env.COGNITO_USER_POOL_ID,
        clientId: process.env.COGNITO_CLIENT_ID,
        tokenUse: "id",
      });
      console.log("✅ Cognito verifier initialized");
    }

    // Get token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    // Verify token
    const payload = await verifier.verify(token);
    req.user = payload;

    next();
  } catch (err) {
    console.error("❌ Auth error:", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
