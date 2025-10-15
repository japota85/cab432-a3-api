import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqs } from "../aws/sqsClient.js";

export const sendToQueue = async (messageBody) => {
  try {
    const command = new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(messageBody),
    });
    const response = await sqs.send(command);
    console.log("✅ Sent to SQS:", response.MessageId);
  } catch (err) {
    console.error("❌ Failed to send message:", err);
  }
};
