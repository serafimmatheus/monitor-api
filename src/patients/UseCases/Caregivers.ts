import { ErrorBadRequest } from "../../errors/ErrorBadRequest.js";
import { ErrorConflict } from "../../errors/ErrorConflict.js";
import { ErrorNotFound } from "../../errors/ErrorNotFound.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { assertPatientCaregiverAccess } from "../../lib/assertPatientCaregiverAccess.js";

export class ListPatientCaregivers {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, patientId: string) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const rows = await this.prisma.patientCaregiver.findMany({
      where: { patientId },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return {
      caregivers: rows.map((r) => ({
        userId: r.userId,
        email: r.user.email,
        name: r.user.name,
        image: r.user.image,
        linkedAt: r.createdAt.toISOString(),
      })),
    };
  }
}

export class AddPatientCaregiver {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, patientId: string, email: string) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const normalized = email.trim().toLowerCase();
    const target = await this.prisma.user.findUnique({
      where: { email: normalized },
    });
    if (target) {
      const existing = await this.prisma.patientCaregiver.findUnique({
        where: {
          patientId_userId: { patientId, userId: target.id },
        },
      });
      if (existing) {
        throw new ErrorConflict("Este usuário já é cuidador deste paciente");
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.patientCaregiver.create({
          data: { patientId, userId: target.id },
        });
        await tx.patientCaregiverInvite.deleteMany({
          where: { patientId, email: normalized },
        });
      });
      return {
        status: "linked" as const,
        userId: target.id,
        email: target.email,
        name: target.name,
      };
    }

    await this.prisma.patientCaregiverInvite.upsert({
      where: {
        patientId_email: { patientId, email: normalized },
      },
      create: { patientId, email: normalized },
      update: {},
    });
    return {
      status: "pending_invite" as const,
      email: normalized,
    };
  }
}

export class RemovePatientCaregiver {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    requesterUserId: string,
    patientId: string,
    caregiverUserId: string,
  ) {
    await assertPatientCaregiverAccess(this.prisma, {
      userId: requesterUserId,
      patientId,
    });
    const count = await this.prisma.patientCaregiver.count({
      where: { patientId },
    });
    if (count <= 1) {
      throw new ErrorBadRequest(
        "Não é possível remover o último cuidador do paciente",
      );
    }
    const link = await this.prisma.patientCaregiver.findUnique({
      where: {
        patientId_userId: { patientId, userId: caregiverUserId },
      },
    });
    if (!link) {
      throw new ErrorNotFound("Cuidador não vinculado a este paciente");
    }
    await this.prisma.patientCaregiver.delete({
      where: {
        patientId_userId: { patientId, userId: caregiverUserId },
      },
    });
  }
}
