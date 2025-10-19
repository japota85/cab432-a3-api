import fetch from "node-fetch";

const apiEndpoint = "http://13.54.194.236:3000/process";
const totalRequests = 50;

async function sendLoad() {
  for (let i = 1; i <= totalRequests; i++) {
    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Load test message ${i}` }),
      });
      console.log(`Sent message ${i}: ${response.status}`);
    } catch (err) {
      console.error(`Error sending message ${i}:`, err.message);
    }
  }
}

sendLoad();
