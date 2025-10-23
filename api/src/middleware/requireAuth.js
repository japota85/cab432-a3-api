import { CognitoJwtVerifier } from "aws-jwt-verify";

console.log("🟡 Loading requireAuth middleware...");

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID,
});

export async function requireAuth(req, res, next) {
  console.log("🔹 requireAuth called");
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log("❌ No Authorization header");
      return res.status(401).json({ error: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    console.log("🟢 Token received (first 50 chars):", token.slice(0, 50));

    const payload = await verifier.verify(token);
    console.log("✅ Token verified:", payload);

    req.user = payload;
    next();
  } catch (err) {
    console.error("❌ Verification failed:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
