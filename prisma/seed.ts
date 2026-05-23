import "dotenv/config";

import { auth } from "../src/lib/auth.js";
import { prisma } from "../src/lib/db.js";

async function seedAdminUser() {
  const email = "admin@monitor.com";
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return;
  }

  await auth.api.signUpEmail({
    body: {
      email,
      password: "admin123",
      name: "Administrador",
    },
  });
}

async function main() {
  await seedAdminUser();
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
