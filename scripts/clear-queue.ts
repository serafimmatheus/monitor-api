import "dotenv/config";

import {
  GetQueueAttributesCommand,
  PurgeQueueCommand,
} from "@aws-sdk/client-sqs";

import { drainQueue } from "../src/lib/drainQueue.js";
import { queueUrl, sqsClient } from "../src/lib/sqs.js";

async function getApproximateMessageCount() {
  if (!queueUrl) {
    return null;
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

async function main() {
  if (!queueUrl) {
    console.error("SQS_QUEUE_URL nao configurada.");
    process.exit(1);
  }

  const before = await getApproximateMessageCount();
  console.log(`Fila: ${queueUrl}`);
  console.log(`Mensagens antes: ${before ?? "?"}`);

  try {
    await sqsClient.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));
    console.log("Fila limpa com purge (SQS).");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("PurgeQueueInProgress")) {
      console.log("Purge recente em andamento. Esvaziando mensagens manualmente...");
      await drainQueue();
      console.log("Fila limpa com drain.");
      return;
    }

    throw error;
  }

  const after = await getApproximateMessageCount();
  console.log(`Mensagens depois: ${after ?? "?"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
