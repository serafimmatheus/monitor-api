import "dotenv/config";

import { prisma } from "../src/lib/db.js";

async function main() {
  const result = await prisma.client.deleteMany();
  console.log(`Clientes removidos: ${result.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
