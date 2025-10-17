import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
dotenv.config();

const sqs = new SQSClient({ region: process.env.AWS_REGION });
const queueUrl = process.env.SQS_QUEUE_URL;

async function pollMessages() {
  console.log("👂 Worker listening for messages...");
  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10,
    });

    const response = await sqs.send(command);
    if (response.Messages) {
      for (const msg of response.Messages) {
        console.log("📦 Received:", msg.Body);

        // TODO: Add video processing logic here (ffmpeg, etc.)

        // Delete message after successful processing
        await sqs.send(new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: msg.ReceiptHandle,
        }));
        console.log("✅ Message processed and deleted");
      }
    }
  } catch (err) {
    console.error("❌ Worker error:", err);
  }
  setTimeout(pollMessages, 5000);
}

pollMessages();
