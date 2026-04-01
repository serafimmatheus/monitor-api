import { ErrorForbidden } from "../errors/ErrorForbidden.js";
import type { PrismaClient } from "../generated/prisma/client.js";

type Db = Pick<PrismaClient, "patientCaregiver">;

/**
 * Garante que o usuário é cuidador vinculado ao paciente.
 * Use em toda rota que recebe `patientId` para isolamento entre famílias.
 */
export async function assertPatientCaregiverAccess(
  db: Db,
  params: { userId: string; patientId: string },
): Promise<void> {
  const link = await db.patientCaregiver.findUnique({
    where: {
      patientId_userId: {
        patientId: params.patientId,
        userId: params.userId,
      },
    },
  });

  if (!link) {
    throw new ErrorForbidden(
      "Você não tem permissão para acessar os dados deste paciente",
    );
  }
}
