import dotenv from "dotenv";

dotenv.config(); // Loads .env from current working directory
console.log("Loaded Pool ID:", process.env.COGNITO_USER_POOL_ID);
