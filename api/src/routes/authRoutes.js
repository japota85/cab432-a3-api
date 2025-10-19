import { Router } from "express";
import { CognitoIdentityProviderClient, InitiateAuthCommand, RespondToAuthChallengeCommand } from "@aws-sdk/client-cognito-identity-provider";
import crypto from "crypto";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

// Helper for Cognito’s secret hash
function generateSecretHash(username, clientId, clientSecret) {
  return crypto
    .createHmac("SHA256", clientSecret)
    .update(username + clientId)
    .digest("base64");
}

// Login route
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    // compute SecretHash exactly how Cognito expects it
    const secretHash = generateSecretHash(
      username,
      process.env.COGNITO_CLIENT_ID,
      process.env.COGNITO_CLIENT_SECRET
    );

    const params = {
      AuthFlow: "USER_PASSWORD_AUTH", // must match your client config
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        SECRET_HASH: secretHash,
      },
      ClientMetadata: {
        username: username,
      },
    };
    
    console.log("=== COGNITO PARAMS ===");
    console.log(JSON.stringify(params, null, 2));

    const command = new InitiateAuthCommand(params);
    const response = await cognito.send(command);

    // Handle password reset challenge
    if (response.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      const challenge = new RespondToAuthChallengeCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: response.Session,
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: password,
          SECRET_HASH: secretHash,
        },
      });
      const finalResponse = await cognito.send(challenge);
      return res.json({ token: finalResponse.AuthenticationResult?.IdToken });
    }

    const authResult = response.AuthenticationResult;
    if (!authResult) return res.status(401).json({ error: "Login failed" });

    return res.json({
      message: "Login successful",
      tokens: {
        idToken: authResult.IdToken,
        accessToken: authResult.AccessToken,
        refreshToken: authResult.RefreshToken,
      },
    });
  } catch (error) {
    console.error("[auth] login error:", error);

    const message = error.message || "Internal error";
    const type = error.name || error.__type || "UnknownError";
    const awsInfo = {
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId,
      errorType: error.$response?.headers?.["x-amzn-errortype"],
      errorMessage: error.$response?.headers?.["x-amzn-errormessage"],
    };

    res.status(500).json({ error: message, type, awsInfo });
  }
});

// Protected route
router.get("/me", requireAuth, (req, res) => {
  return res.json({
    message: "Token valid",
    user: {
      sub: req.user.sub,
      email: req.user.email,
    },
  });
});

export default router;
