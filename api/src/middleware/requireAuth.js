import { CognitoJwtVerifier } from "aws-jwt-verify";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

// Create verifier once (outside handler)
let verifier;

export async function requireAuth(req, res, next) {
  try {
    if (!verifier) {
      verifier = CognitoJwtVerifier.create({
        userPoolId: process.env.COGNITO_USER_POOL_ID,
        clientId: process.env.COGNITO_CLIENT_ID,
        tokenUse: "access",
      });
      console.log("✅ Cognito AccessToken verifier initialized");
    }

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    // Verify access token
    const payload = await verifier.verify(token);
    req.user = payload;

    next();
  } catch (err) {
    console.error("❌ Auth error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}