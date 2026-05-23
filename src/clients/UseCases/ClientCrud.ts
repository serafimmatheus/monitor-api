import type { Client, PrismaClient } from "../../generated/prisma/client.js";
import { parseDocument } from "../lib/document.js";
import type { ClientDto } from "../schemas.js";

export function toClientDto(client: Client): ClientDto {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    document: client.document,
    documentType: client.documentType,
    status: client.status,
    updatedAt: client.updatedAt.toISOString(),
  };
}

export class ListClients {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(): Promise<ClientDto[]> {
    const clients = await this.prisma.client.findMany({
      orderBy: { name: "asc" },
    });

    return clients.map(toClientDto);
  }
}

export class GetClient {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(clientId: string): Promise<ClientDto | null> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) return null;
    return toClientDto(client);
  }
}

export class CreateClient {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: {
    name: string;
    email: string;
    document: string;
  }): Promise<ClientDto> {
    const { document, documentType } = parseDocument(input.document);

    const client = await this.prisma.client.create({
      data: {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        document,
        documentType,
      },
    });

    return toClientDto(client);
  }
}

export class UpdateClient {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    clientId: string,
    input: {
      name?: string;
      email?: string;
      document?: string;
    },
  ): Promise<ClientDto | null> {
    const existing = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!existing) return null;

    const data: {
      name?: string;
      email?: string;
      document?: string;
      documentType?: Client["documentType"];
    } = {};

    if (input.name !== undefined) {
      data.name = input.name.trim();
    }

    if (input.email !== undefined) {
      data.email = input.email.trim().toLowerCase();
    }

    if (input.document !== undefined) {
      const parsed = parseDocument(input.document);
      data.document = parsed.document;
      data.documentType = parsed.documentType;
    }

    const client = await this.prisma.client.update({
      where: { id: clientId },
      data,
    });

    return toClientDto(client);
  }
}

export class DeleteClient {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(clientId: string): Promise<boolean> {
    const existing = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!existing) return false;

    await this.prisma.client.delete({ where: { id: clientId } });
    return true;
  }
}
