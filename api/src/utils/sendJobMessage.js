import { SendMessageCommand } from "@aws-sdk/client-sqs";
import sqsClient from "../config/sqsClient.js";

export async function sendJobMessage(videoId, s3Key, userId) {
  const messageBody = JSON.stringify({
    videoId,
    s3Key,
    userId,
    operation: "transcode",
  });

  const params = {
    QueueUrl: process.env.SQS_QUEUE_URL, // we'll set later
    MessageBody: messageBody,
  };

  try {
    await sqsClient.send(new SendMessageCommand(params));
    console.log("✅ Job queued:", messageBody);
  } catch (err) {
    console.error("❌ Failed to queue job:", err);
  }
}
