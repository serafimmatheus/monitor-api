import * as XLSX from "xlsx";

import type { PrismaClient } from "../../generated/prisma/client.js";
import { parseDocument } from "../lib/document.js";
import type { PlanService } from "../../plans/UseCases/PlanService.js";

type ImportRow = {
  row: number;
  name: string;
  email: string;
  document: string;
};

type ImportResult = {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

const NAME_HEADERS = ["nome", "razao social", "razão social", "name"];
const EMAIL_HEADERS = ["email", "e-mail"];
const DOCUMENT_HEADERS = [
  "cnpj",
  "cpf",
  "documento",
  "document",
  "cnpj ou cpf",
  "cnpj/cpf",
];

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function findColumnIndex(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.includes(header));
}

function parseSpreadsheet(buffer: Buffer): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Planilha vazia");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  });

  if (rows.length < 2) {
    throw new Error("Planilha deve conter cabecalho e ao menos uma linha");
  }

  const headers = (rows[0] ?? []).map(normalizeHeader);
  const nameIndex = findColumnIndex(headers, NAME_HEADERS);
  const emailIndex = findColumnIndex(headers, EMAIL_HEADERS);
  const documentIndex = findColumnIndex(headers, DOCUMENT_HEADERS);

  if (nameIndex === -1 || emailIndex === -1 || documentIndex === -1) {
    throw new Error(
      "Colunas obrigatorias: nome/razao social, email e cnpj/cpf",
    );
  }

  const parsed: ImportRow[] = [];

  for (let index = 1; index < rows.length; index++) {
    const row = rows[index] ?? [];
    const name = String(row[nameIndex] ?? "").trim();
    const email = String(row[emailIndex] ?? "").trim();
    const document = String(row[documentIndex] ?? "").trim();

    if (!name && !email && !document) {
      continue;
    }

    parsed.push({
      row: index + 1,
      name,
      email,
      document,
    });
  }

  return parsed;
}

export class ImportClientsFromSpreadsheet {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly planService: PlanService,
  ) {}

  async execute(userId: string, buffer: Buffer): Promise<ImportResult> {
    await this.planService.assertCanImport(userId);

    const rows = parseSpreadsheet(buffer);
    const errors: ImportResult["errors"] = [];
    const validRows: {
      name: string;
      email: string;
      document: string;
      documentType: "CNPJ" | "CPF";
    }[] = [];

    for (const row of rows) {
      if (!row.name) {
        errors.push({ row: row.row, message: "Nome e obrigatorio" });
        continue;
      }

      if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push({ row: row.row, message: "Email invalido" });
        continue;
      }

      try {
        const { document, documentType } = parseDocument(row.document);
        validRows.push({
          name: row.name,
          email: row.email.toLowerCase(),
          document,
          documentType,
        });
      } catch (error) {
        errors.push({
          row: row.row,
          message:
            error instanceof Error ? error.message : "Documento invalido",
        });
      }
    }

    const documentsInFile = new Set<string>();
    const uniqueRows = validRows.filter((row) => {
      if (documentsInFile.has(row.document)) {
        errors.push({
          row: 0,
          message: `Documento duplicado na planilha: ${row.document}`,
        });
        return false;
      }
      documentsInFile.add(row.document);
      return true;
    });

    const existing = await this.prisma.client.findMany({
      where: { document: { in: uniqueRows.map((row) => row.document) } },
      select: { document: true },
    });
    const existingDocuments = new Set(existing.map((client) => client.document));

    const toCreate = uniqueRows.filter((row) => !existingDocuments.has(row.document));
    const skipped = uniqueRows.length - toCreate.length;

    if (toCreate.length > 0) {
      await this.prisma.client.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    return {
      imported: toCreate.length,
      skipped,
      errors,
    };
  }
}
