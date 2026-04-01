import type { PrismaClient } from "../../generated/prisma/client.js";

/**
 * Cria vínculos PatientCaregiver para convites pendentes com o mesmo e-mail e remove os convites.
 * Chamado após criação de usuário (cadastro ou OAuth).
 */
export async function claimPendingCaregiverInvites(
  prisma: PrismaClient,
  userId: string,
  email: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const invites = await prisma.patientCaregiverInvite.findMany({
    where: { email: normalized },
  });
  if (invites.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const inv of invites) {
      await tx.patientCaregiver.upsert({
        where: {
          patientId_userId: { patientId: inv.patientId, userId },
        },
        create: { patientId: inv.patientId, userId },
        update: {},
      });
    }
    await tx.patientCaregiverInvite.deleteMany({
      where: { email: normalized },
    });
  });
}
