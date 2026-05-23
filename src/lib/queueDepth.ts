import { GetQueueAttributesCommand } from "@aws-sdk/client-sqs";

import { queueUrl, sqsClient } from "./sqs.js";

export async function getApproximateQueueDepth() {
  if (!queueUrl) {
    return 0;
  }

  const response = await sqsClient.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: [
        "ApproximateNumberOfMessages",
        "ApproximateNumberOfMessagesNotVisible",
      ],
    }),
  );

  const visible = Number(response.Attributes?.ApproximateNumberOfMessages ?? 0);
  const inFlight = Number(
    response.Attributes?.ApproximateNumberOfMessagesNotVisible ?? 0,
  );

  return visible + inFlight;
}
