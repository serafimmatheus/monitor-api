import "dotenv/config";

import { auth } from "../src/lib/auth.js";
import { prisma } from "../src/lib/db.js";
import { PlanService } from "../src/plans/UseCases/PlanService.js";

async function seedAdminUser() {
  const email = "admin@monitor.com";
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return existing;
  }

  await auth.api.signUpEmail({
    body: {
      email,
      password: "admin123",
      name: "Administrador",
    },
  });

  return prisma.user.findUniqueOrThrow({ where: { email } });
}

async function main() {
  const admin = await seedAdminUser();
  const planService = new PlanService(prisma);
  await planService.getOrCreateSubscription(admin.id);

  console.log("Seed concluido: usuario admin criado (se nao existia).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
