FROM node:18-slim
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
ENV AWS_REGION=ap-southeast-2

CMD ["node", "index.js"]