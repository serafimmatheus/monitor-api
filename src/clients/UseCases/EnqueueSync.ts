import { SendMessageBatchCommand } from "@aws-sdk/client-sqs";

import type { PrismaClient } from "../../generated/prisma/client.js";
import { queueUrl, sqsClient } from "../../lib/sqs.js";

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export class EnqueueSync {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(): Promise<{ queued: number }> {
    if (!queueUrl) {
      throw new Error("SQS_QUEUE_URL nao configurada");
    }

    const clients = await this.prisma.client.findMany({
      select: { id: true, cnpj: true },
    });

    const batches = chunkArray(clients, 10);

    for (const batch of batches) {
      await sqsClient.send(
        new SendMessageBatchCommand({
          QueueUrl: queueUrl,
          Entries: batch.map((client, index) => ({
            Id: `${client.id}-${index}`,
            MessageBody: JSON.stringify({
              clientId: client.id,
              cnpj: client.cnpj,
            }),
          })),
        }),
      );
    }

    return { queued: clients.length };
  }
}
