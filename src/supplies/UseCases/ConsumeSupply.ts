import { ErrorBadRequest } from "../../errors/ErrorBadRequest.js";
import { ErrorNotFound } from "../../errors/ErrorNotFound.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { CareEventType } from "../../generated/prisma/enums.js";
import { assertPatientCaregiverAccess } from "../../lib/assertPatientCaregiverAccess.js";

export interface ConsumeSupplyInput {
  userId: string;
  patientId: string;
  supplyId: string;
  quantity: number;
  notes?: string;
}

export class ConsumeSupply {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ConsumeSupplyInput) {
    await assertPatientCaregiverAccess(this.prisma, {
      userId: input.userId,
      patientId: input.patientId,
    });

    return this.prisma.$transaction(async (tx) => {
      const supply = await tx.supply.findFirst({
        where: { id: input.supplyId, patientId: input.patientId },
      });

      if (!supply) {
        throw new ErrorNotFound("Insumo não encontrado para este paciente");
      }

      if (supply.currentQuantity < input.quantity) {
        throw new ErrorBadRequest(
          "Quantidade insuficiente em estoque para este consumo",
        );
      }

      const updated = await tx.supply.update({
        where: { id: supply.id },
        data: {
          currentQuantity: { decrement: input.quantity },
        },
      });

      const event = await tx.careEvent.create({
        data: {
          patientId: input.patientId,
          type: CareEventType.SUPPLY_CONSUMED,
          quantity: input.quantity,
          notes: input.notes,
          supplyId: supply.id,
          performedByUserId: input.userId,
        },
      });

      const lowStockWarning = updated.currentQuantity <= updated.minQuantity;

      return {
        supply: {
          id: updated.id,
          patientId: updated.patientId,
          name: updated.name,
          currentQuantity: updated.currentQuantity,
          minQuantity: updated.minQuantity,
          unit: updated.unit,
          updatedAt: updated.updatedAt.toISOString(),
        },
        careEventId: event.id,
        lowStockWarning,
        warningMessage: lowStockWarning
          ? `Estoque em ou abaixo do mínimo (${updated.minQuantity} ${updated.unit})`
          : undefined,
      };
    });
  }
}
