import { ErrorNotFound } from "../../errors/ErrorNotFound.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { assertPatientCaregiverAccess } from "../../lib/assertPatientCaregiverAccess.js";

function toSupplyDto(s: {
  id: string;
  patientId: string;
  name: string;
  currentQuantity: number;
  minQuantity: number;
  unit: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    patientId: s.patientId,
    name: s.name,
    currentQuantity: s.currentQuantity,
    minQuantity: s.minQuantity,
    unit: s.unit,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export class ListSupplies {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, patientId: string) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const supplies = await this.prisma.supply.findMany({
      where: { patientId },
      orderBy: { name: "asc" },
    });
    return { supplies: supplies.map(toSupplyDto) };
  }
}

export class CreateSupply {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    patientId: string,
    input: {
      name: string;
      currentQuantity?: number;
      minQuantity?: number;
      unit: string;
    },
  ) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const supply = await this.prisma.supply.create({
      data: {
        patientId,
        name: input.name.trim(),
        currentQuantity: input.currentQuantity ?? 0,
        minQuantity: input.minQuantity ?? 0,
        unit: input.unit.trim(),
      },
    });
    return toSupplyDto(supply);
  }
}

export class UpdateSupply {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    patientId: string,
    supplyId: string,
    input: {
      name?: string;
      currentQuantity?: number;
      minQuantity?: number;
      unit?: string;
    },
  ) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const existing = await this.prisma.supply.findFirst({
      where: { id: supplyId, patientId },
    });
    if (!existing) {
      throw new ErrorNotFound("Insumo não encontrado para este paciente");
    }
    const data: Prisma.SupplyUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.currentQuantity !== undefined)
      data.currentQuantity = input.currentQuantity;
    if (input.minQuantity !== undefined) data.minQuantity = input.minQuantity;
    if (input.unit !== undefined) data.unit = input.unit.trim();
    const supply = await this.prisma.supply.update({
      where: { id: supplyId },
      data,
    });
    return toSupplyDto(supply);
  }
}

export class DeleteSupply {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, patientId: string, supplyId: string) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const existing = await this.prisma.supply.findFirst({
      where: { id: supplyId, patientId },
    });
    if (!existing) {
      throw new ErrorNotFound("Insumo não encontrado para este paciente");
    }
    await this.prisma.supply.delete({ where: { id: supplyId } });
  }
}
