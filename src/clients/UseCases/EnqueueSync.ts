import { PurgeQueueCommand, SendMessageBatchCommand } from "@aws-sdk/client-sqs";

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
      where: { documentType: "CNPJ" },
      select: { id: true, document: true },
    });

    if (clients.length === 0) {
      return { queued: 0 };
    }

    await this.prisma.client.updateMany({
      where: { id: { in: clients.map((client) => client.id) } },
      data: { status: "PENDENTE" },
    });

    await sqsClient.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));

    const batches = chunkArray(clients, 10);

    for (const batch of batches) {
      await sqsClient.send(
        new SendMessageBatchCommand({
          QueueUrl: queueUrl,
          Entries: batch.map((client, index) => ({
            Id: `${client.id}-${index}`,
            MessageBody: JSON.stringify({
              clientId: client.id,
              cnpj: client.document,
            }),
          })),
        }),
      );
    }

    return { queued: clients.length };
  }
}
