import { SendMessageBatchCommand } from "@aws-sdk/client-sqs";

import type { PrismaClient } from "../../generated/prisma/client.js";
import { ErrorForbidden } from "../../errors/ErrorForbidden.js";
import { drainQueue } from "../../lib/drainQueue.js";
import { getApproximateQueueDepth } from "../../lib/queueDepth.js";
import { queueUrl, sqsClient } from "../../lib/sqs.js";
import type { PlanService } from "../../plans/UseCases/PlanService.js";

type SyncClient = { id: string; document: string };

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function enqueueClients(clients: SyncClient[]) {
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
}

export class EnqueueSync {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly planService: PlanService,
  ) {}

  async execute(userId: string): Promise<{ queued: number }> {
    if (!queueUrl) {
      throw new Error("SQS_QUEUE_URL nao configurada");
    }

    const pendingClients = await this.prisma.client.findMany({
      where: { documentType: "CNPJ", status: "PENDENTE" },
      select: { id: true, document: true },
    });

    if (pendingClients.length > 0) {
      const queueDepth = await getApproximateQueueDepth();

      if (queueDepth > 0) {
        throw new ErrorForbidden(
          "Ja existe uma sincronizacao em andamento. Aguarde a conclusao.",
        );
      }

      await drainQueue();
      await enqueueClients(pendingClients);

      return { queued: pendingClients.length };
    }

    await this.planService.assertCanSync(userId);

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

    await drainQueue();
    await enqueueClients(clients);
    await this.planService.recordSync(userId);

    return { queued: clients.length };
  }
}
