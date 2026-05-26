import type {
  Client,
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client.js";
import { getApproximateQueueDepth } from "../../lib/queueDepth.js";
import { normalizeDocument, parseDocument } from "../lib/document.js";
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

function buildSearchWhere(search?: string): Prisma.ClientWhereInput | undefined {
  const term = search?.trim();
  if (!term) return undefined;

  const documentTerm = normalizeDocument(term);
  const filters: Prisma.ClientWhereInput[] = [
    { name: { contains: term, mode: "insensitive" } },
  ];

  if (documentTerm.length > 0) {
    filters.push({ document: { contains: documentTerm } });
  }

  return { OR: filters };
}

function buildClientsWhere(input: {
  search?: string;
  status?: string[];
}): Prisma.ClientWhereInput | undefined {
  const filters: Prisma.ClientWhereInput[] = [];

  const searchWhere = buildSearchWhere(input.search);
  if (searchWhere) {
    filters.push(searchWhere);
  }

  if (input.status && input.status.length > 0) {
    filters.push({ status: { in: input.status } });
  }

  if (filters.length === 0) return undefined;
  if (filters.length === 1) return filters[0];
  return { AND: filters };
}

export class ListClients {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string[];
  }) {
    const where = buildClientsWhere(input);
    const skip = (input.page - 1) * input.pageSize;

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: input.pageSize,
      }),
      this.prisma.client.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));

    return {
      data: clients.map(toClientDto),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages,
      },
    };
  }
}

export class GetClientsSummary {
  constructor(private readonly prisma: PrismaClient) {}

  async execute() {
    const counts = await this.prisma.client.groupBy({
      by: ["status"],
      where: { documentType: "CNPJ" },
      _count: { _all: true },
    });

    const statusCounts = Object.fromEntries(
      counts.map((entry) => [entry.status, entry._count._all]),
    );

    const ativos = statusCounts.ATIVA ?? 0;
    const pendentes = statusCounts.PENDENTE ?? 0;
    const baixadas = statusCounts.BAIXADA ?? 0;
    const inaptos = statusCounts.INAPTA ?? 0;
    const suspensas = statusCounts.SUSPENSA ?? 0;
    const erros = statusCounts.ERRO ?? 0;
    const totalCnpj = counts.reduce((sum, entry) => sum + entry._count._all, 0);
    const pendingCnpj = pendentes;
    const queueDepth = await getApproximateQueueDepth();

    return {
      ativos,
      pendentes,
      baixadas,
      inaptos,
      suspensas,
      erros,
      totalCnpj,
      pendingCnpj,
      hasPendingSync: queueDepth > 0,
    };
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
