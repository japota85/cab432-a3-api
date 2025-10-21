const AWS = require("aws-sdk");
const dotenv = require("dotenv");
const path = require("path");

const cloudwatch = new AWS.CloudWatch({ region: process.env.AWS_REGION });

// load the .env from the API folder
dotenv.config({ path: path.resolve(__dirname, "../api/.env") });

console.log("Loaded SQS URL:", process.env.SQS_QUEUE_URL);

AWS.config.update({ region: process.env.AWS_REGION });

const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });
  async function publishQueueMetric(count) {
  try {
    await cloudwatch.putMetricData({
      Namespace: "CAB432/A3",
      MetricData: [
        {
          MetricName: "PendingMessages",
          Unit: "Count",
          Value: count,
        },
      ],
    }).promise();
    console.log(`📊 Published CloudWatch metric: PendingMessages = ${count}`);
  } catch (err) {
    console.error("❌ Error publishing metric:", err);
  }
}

async function pollMessages() {
  console.log("🎧 Worker started, polling messages from SQS...");

  const params = {
    QueueUrl: process.env.SQS_QUEUE_URL,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 10,
  };

  try {
    const data = await sqs.receiveMessage(params).promise();
      // Publish number of pending messages to CloudWatch (approximation)
      const pendingCount = data.Messages ? data.Messages.length : 0;
      await publishQueueMetric(pendingCount);


    if (data.Messages && data.Messages.length > 0) {
      const message = data.Messages[0];
      console.log("📩 Received message:", message.Body);

      let body;
        try {
          body = JSON.parse(message.Body);
          console.log(`Processing video ID: ${body.videoId || "N/A"}, task: ${body.task || "N/A"}`);
        } catch (parseErr) {
          console.warn("⚠️ Message is not valid JSON:", message.Body);
          body = { raw: message.Body };
        }

      await sqs
        .deleteMessage({
          QueueUrl: process.env.SQS_QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle,
        })
        .promise();

      console.log("✅ Message processed and deleted");
    } else {
      console.log("No messages in queue...");
    }
  } catch (err) {
    console.error("❌ Error receiving or processing message:", err);
  }

  setTimeout(pollMessages, 5000);
}

pollMessages();
