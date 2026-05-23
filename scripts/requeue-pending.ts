import "dotenv/config";

import { SendMessageBatchCommand } from "@aws-sdk/client-sqs";

import { prisma } from "../src/lib/db.js";
import { drainQueue } from "../src/lib/drainQueue.js";
import { getApproximateQueueDepth } from "../src/lib/queueDepth.js";
import { queueUrl, sqsClient } from "../src/lib/sqs.js";

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function main() {
  if (!queueUrl) {
    throw new Error("SQS_QUEUE_URL nao configurada");
  }

  const pendingClients = await prisma.client.findMany({
    where: { documentType: "CNPJ", status: "PENDENTE" },
    select: { id: true, document: true },
  });

  if (pendingClients.length === 0) {
    console.log("Nenhum cliente pendente para reenfileirar.");
    return;
  }

  const queueDepth = await getApproximateQueueDepth();
  console.log(`Clientes pendentes: ${pendingClients.length}`);
  console.log(`Mensagens na fila: ${queueDepth}`);

  if (queueDepth > 0) {
    console.log("A fila ainda tem mensagens. Nada a fazer.");
    return;
  }

  await drainQueue();

  const batches = chunkArray(pendingClients, 10);

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

  const after = await getApproximateQueueDepth();
  console.log(`Reenfileirados: ${pendingClients.length}`);
  console.log(`Mensagens na fila agora: ${after}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
