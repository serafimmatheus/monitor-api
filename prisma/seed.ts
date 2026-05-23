import "dotenv/config";

import { auth } from "../src/lib/auth.js";
import { prisma } from "../src/lib/db.js";

const COMPANY_NAMES = [
  "Alpha Comercio",
  "Beta Servicos",
  "Gamma Industria",
  "Delta Logistica",
  "Epsilon Tech",
  "Zeta Alimentos",
  "Eta Construcoes",
  "Theta Consultoria",
  "Iota Transportes",
  "Kappa Financeira",
];

function calculateCheckDigit(digits: number[], weights: number[]) {
  const sum = digits.reduce(
    (acc, digit, index) => acc + digit * weights[index],
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function generateValidCnpj(index: number) {
  const base = String(index).padStart(8, "0");
  const digits = [...base.split("").map(Number), 0, 0, 0, 1];

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const firstCheck = calculateCheckDigit(digits, firstWeights);
  digits.push(firstCheck);

  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondCheck = calculateCheckDigit(digits, secondWeights);
  digits.push(secondCheck);

  return digits.join("");
}

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

async function seedClients() {
  await prisma.client.deleteMany();

  const clients = Array.from({ length: 500 }, (_, index) => ({
    name: `${COMPANY_NAMES[index % COMPANY_NAMES.length]} ${index + 1}`,
    email: `cliente${index + 1}@example.com`,
    document: generateValidCnpj(index + 1),
    documentType: "CNPJ" as const,
    status: "PENDENTE",
  }));

  await prisma.client.createMany({ data: clients });
}

async function main() {
  await seedAdminUser();
  await seedClients();
  console.log("Seed concluido: 1 usuario e 500 clientes criados.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
