import { SQSClient } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";

dotenv.config();

export const sqs = new SQSClient({
  region: process.env.AWS_REGION,
});
