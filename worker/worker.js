const AWS = require("aws-sdk");
import path from "path";

require("dotenv").config({
  path: path.resolve(__dirname, "../api/.env"),
});


const sqs = new AWS.SQS({ region: process.env.AWS_REGION });
const queueUrl = process.env.SQS_QUEUE_URL;

async function pollMessages() {
  console.log("🎧 Worker started, polling messages from SQS...");

  const params = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 10
  };

  while (true) {
    try {
      const data = await sqs.receiveMessage(params).promise();

      if (data.Messages && data.Messages.length > 0) {
        for (const message of data.Messages) {
          console.log("📩 Received message:", message.Body);

          const body = JSON.parse(message.Body);
          console.log(`Processing video ID: ${body.videoId} with task: ${body.task}`);

          await sqs
            .deleteMessage({
              QueueUrl: queueUrl,
              ReceiptHandle: message.ReceiptHandle
            })
            .promise();

          console.log("✅ Message processed and deleted");
        }
      }
    } catch (err) {
      console.error("❌ Error receiving or processing message:", err);
    }
  }
}

pollMessages();
