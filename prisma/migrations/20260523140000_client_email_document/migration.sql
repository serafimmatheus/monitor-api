-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CNPJ', 'CPF');

-- AlterTable
ALTER TABLE "client" RENAME COLUMN "cnpj" TO "document";

ALTER TABLE "client" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';
ALTER TABLE "client" ADD COLUMN "documentType" "DocumentType" NOT NULL DEFAULT 'CNPJ';

ALTER TABLE "client" ALTER COLUMN "email" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "client_cnpj_key" RENAME TO "client_document_key";
