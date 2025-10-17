import AWS from "aws-sdk";

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

          // Example: Simulate video processing
          const body = JSON.parse(message.Body);
          console.log(`Processing video ID: ${body.videoId} with task: ${body.task}`);

          // Delete message after successful processing
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
