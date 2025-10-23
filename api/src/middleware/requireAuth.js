// src/middleware/requireAuth.js
import { CognitoJwtVerifier } from "aws-jwt-verify";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" }); // works when you run `npm run start` from /api

let verifier;

export async function requireAuth(req, res, next) {
  try {
    if (!verifier) {
      const { COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID } = process.env;
      if (!COGNITO_USER_POOL_ID || !COGNITO_CLIENT_ID) {
        console.error("❌ Missing env",
          { COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID });
        return res.status(500).json({ error: "Server misconfigured (env)" });
      }

      verifier = CognitoJwtVerifier.create({
        userPoolId: COGNITO_USER_POOL_ID,
        clientId: COGNITO_CLIENT_ID,
        tokenUse: "access",
      });
      console.log("✅ Cognito AccessToken verifier initialized");
    }

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Missing token" });

    const payload = await verifier.verify(token);
    req.user = payload;
    next();
  } catch (err) {
    console.error("❌ Auth error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
