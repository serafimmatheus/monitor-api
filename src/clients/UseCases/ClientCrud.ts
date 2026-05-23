import type { Client, PrismaClient } from "../../generated/prisma/client.js";
import type { ClientDto } from "../schemas.js";

export function toClientDto(client: Client): ClientDto {
  return {
    id: client.id,
    name: client.name,
    cnpj: client.cnpj,
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
