import type { DocumentType } from "../../generated/prisma/client.js";

export function normalizeDocument(value: string): string {
  return value.replace(/\D/g, "");
}

export function detectDocumentType(digits: string): DocumentType | null {
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  return null;
}

function calculateCheckDigit(digits: number[], weights: number[]) {
  const sum = digits.reduce(
    (acc, digit, index) => acc + digit * weights[index],
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;

  const numbers = digits.split("").map(Number);
  const firstCheck = calculateCheckDigit(
    numbers.slice(0, 9),
    [10, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  if (firstCheck !== numbers[9]) return false;

  const secondCheck = calculateCheckDigit(
    numbers.slice(0, 10),
    [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return secondCheck === numbers[10];
}

export function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;

  const numbers = digits.split("").map(Number);
  const firstCheck = calculateCheckDigit(
    numbers.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  if (firstCheck !== numbers[12]) return false;

  const secondCheck = calculateCheckDigit(
    numbers.slice(0, 13),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return secondCheck === numbers[13];
}

export function parseDocument(value: string): {
  document: string;
  documentType: DocumentType;
} {
  const document = normalizeDocument(value);
  const documentType = detectDocumentType(document);

  if (!documentType) {
    throw new Error("Documento deve ter 11 (CPF) ou 14 (CNPJ) digitos");
  }

  if (documentType === "CPF" && !isValidCpf(document)) {
    throw new Error("CPF invalido");
  }

  if (documentType === "CNPJ" && !isValidCnpj(document)) {
    throw new Error("CNPJ invalido");
  }

  return { document, documentType };
}
