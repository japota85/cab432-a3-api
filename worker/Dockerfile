# --- CAB432 A3 Worker Dockerfile ---
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package.json (if any) and install dependencies
COPY package*.json ./
RUN npm install

# Copy the worker source code
COPY . .

# Environment variables (SQS + AWS Region will be injected at runtime)
ENV AWS_REGION=ap-southeast-2

# Start the worker
CMD ["node", "worker.js"]
