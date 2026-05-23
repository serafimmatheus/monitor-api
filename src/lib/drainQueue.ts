import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
} from "@aws-sdk/client-sqs";

import { queueUrl, sqsClient } from "./sqs.js";

export async function drainQueue() {
  if (!queueUrl) {
    return;
  }

  while (true) {
    const response = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 0,
      }),
    );

    const messages = response.Messages ?? [];
    if (messages.length === 0) {
      return;
    }

    await Promise.all(
      messages
        .filter((message) => message.ReceiptHandle)
        .map((message) =>
          sqsClient.send(
            new DeleteMessageCommand({
              QueueUrl: queueUrl,
              ReceiptHandle: message.ReceiptHandle!,
            }),
          ),
        ),
    );
  }
}
