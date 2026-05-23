import type { PlanTier } from "../generated/prisma/client.js";

export type PlanLimits = {
  maxSyncsPerMonth: number;
  allowImport: boolean;
  label: string;
  priceCents: number;
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  FREE: {
    maxSyncsPerMonth: 0,
    allowImport: false,
    label: "Gratuito",
    priceCents: 0,
  },
  STARTER: {
    maxSyncsPerMonth: 2,
    allowImport: false,
    label: "Starter",
    priceCents: 5000,
  },
  PRO: {
    maxSyncsPerMonth: 10,
    allowImport: true,
    label: "Pro",
    priceCents: 10000,
  },
};

export function getCurrentYearMonth(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
