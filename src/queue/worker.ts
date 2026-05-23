import "dotenv/config";
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
} from "@aws-sdk/client-sqs";

import { prisma } from "../lib/db.js";
import { queueUrl, sqsClient } from "../lib/sqs.js";

const SYNC_DELAY_MS = Number(process.env.SYNC_DELAY_MS || 3000);
const MAX_ATTEMPTS = 3;

const STATUS_MAP: Record<string, string> = {
  ATIVA: "ATIVA",
  BAIXADA: "BAIXADA",
  SUSPENSA: "SUSPENSA",
  INAPTA: "INAPTA",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapBrasilApiStatus(description: string | undefined) {
  if (!description) return "ERRO";

  const normalized = description.toUpperCase().trim();
  return STATUS_MAP[normalized] ?? "ERRO";
}

async function fetchCnpjStatus(cnpj: string) {
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);

  if (!response.ok) {
    return "ERRO";
  }

  const data = (await response.json()) as {
    descricao_situacao_cadastral?: string;
  };

  return mapBrasilApiStatus(data.descricao_situacao_cadastral);
}

async function processMessage(message: {
  Body?: string;
  ReceiptHandle?: string;
  Attributes?: Record<string, string>;
}) {
  if (!message.Body || !message.ReceiptHandle) {
    return;
  }

  const payload = JSON.parse(message.Body) as { clientId: string; cnpj: string };
  const receiveCount = Number(message.Attributes?.ApproximateReceiveCount || 1);

  try {
    const status = await fetchCnpjStatus(payload.cnpj);

    await prisma.client.update({
      where: { id: payload.clientId },
      data: { status },
    });
  } catch (error) {
    console.error("Erro ao processar mensagem:", error);

    if (receiveCount >= MAX_ATTEMPTS) {
      await prisma.client.update({
        where: { id: payload.clientId },
        data: { status: "ERRO" },
      });
    } else {
      throw error;
    }
  }

  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    }),
  );
}

async function pollQueue() {
  if (!queueUrl) {
    throw new Error("SQS_QUEUE_URL nao configurada");
  }

  console.log("Worker iniciado. Aguardando mensagens...");

  while (true) {
    try {
      const response = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 20,
          MessageSystemAttributeNames: ["ApproximateReceiveCount"],
        }),
      );

      const [message] = response.Messages || [];

      if (!message) {
        continue;
      }

      await processMessage(message);
      await sleep(SYNC_DELAY_MS);
    } catch (error) {
      console.error("Erro no loop do worker:", error);
      await sleep(SYNC_DELAY_MS);
    }
  }
}

pollQueue();
