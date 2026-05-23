import { SQSClient } from "@aws-sdk/client-sqs";

const region = process.env.AWS_REGION || "us-east-1";
const endpoint = process.env.AWS_ENDPOINT_URL;

export const sqsClient = new SQSClient({
  region,
  ...(endpoint
    ? {
        endpoint,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
        },
      }
    : {}),
});

export const queueUrl = process.env.SQS_QUEUE_URL;
