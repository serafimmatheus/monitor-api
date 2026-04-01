import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { CareEventType } from "../../generated/prisma/enums.js";
import { assertPatientCaregiverAccess } from "../../lib/assertPatientCaregiverAccess.js";

export class ListCareEvents {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    patientId: string,
    query: { type?: CareEventType; from?: string; to?: string; limit?: number },
  ) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const where: Prisma.CareEventWhereInput = { patientId };
    if (query.type) where.type = query.type;
    if (query.from || query.to) {
      where.occurredAt = {};
      if (query.from) where.occurredAt.gte = new Date(query.from);
      if (query.to) where.occurredAt.lte = new Date(query.to);
    }
    const take = Math.min(Math.max(query.limit ?? 100, 1), 500);
    const events = await this.prisma.careEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take,
    });
    return {
      careEvents: events.map((e) => ({
        id: e.id,
        patientId: e.patientId,
        type: e.type,
        quantity: e.quantity,
        notes: e.notes,
        supplyId: e.supplyId,
        medicationId: e.medicationId,
        performedByUserId: e.performedByUserId,
        occurredAt: e.occurredAt.toISOString(),
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}
