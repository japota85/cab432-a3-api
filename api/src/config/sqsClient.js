// api/src/config/sqsClient.js
import { SQSClient } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";

dotenv.config();

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "ap-southeast-2",
});

export default sqsClient;
