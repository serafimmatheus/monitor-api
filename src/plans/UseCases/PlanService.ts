import type { PlanTier, PrismaClient } from "../../generated/prisma/client.js";
import { ErrorForbidden } from "../../errors/ErrorForbidden.js";
import {
  getCurrentYearMonth,
  PLAN_LIMITS,
  type PlanLimits,
} from "../planLimits.js";

export type UserPlanInfo = {
  plan: PlanTier;
  label: string;
  priceCents: number;
  maxSyncsPerMonth: number;
  syncsUsed: number;
  syncsRemaining: number;
  canSync: boolean;
  allowImport: boolean;
  yearMonth: string;
};

export class PlanService {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreateSubscription(userId: string) {
    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.subscription.create({
      data: { userId, plan: "FREE" },
    });
  }

  async getUserPlanInfo(userId: string): Promise<UserPlanInfo> {
    const subscription = await this.getOrCreateSubscription(userId);
    const limits = PLAN_LIMITS[subscription.plan];
    const yearMonth = getCurrentYearMonth();
    const syncsUsed = await this.getSyncCount(userId, yearMonth);

    return this.buildPlanInfo(subscription.plan, limits, syncsUsed, yearMonth);
  }

  async assertCanSync(userId: string): Promise<void> {
    const info = await this.getUserPlanInfo(userId);

    if (!info.canSync) {
      if (info.maxSyncsPerMonth === 0) {
        throw new ErrorForbidden(
          "Seu plano gratuito nao permite sincronizacao. Faca upgrade para Starter ou Pro.",
        );
      }

      throw new ErrorForbidden(
        `Limite de ${info.maxSyncsPerMonth} sincronizacoes por mes atingido. Voce ja usou ${info.syncsUsed} este mes.`,
      );
    }
  }

  async assertCanImport(userId: string): Promise<void> {
    const subscription = await this.getOrCreateSubscription(userId);
    const limits = PLAN_LIMITS[subscription.plan];

    if (!limits.allowImport) {
      throw new ErrorForbidden(
        "Importacao de planilhas disponivel apenas no plano Pro. Faca upgrade para importar clientes em massa.",
      );
    }
  }

  async recordSync(userId: string): Promise<void> {
    const yearMonth = getCurrentYearMonth();

    await this.prisma.syncUsage.upsert({
      where: {
        userId_yearMonth: { userId, yearMonth },
      },
      create: {
        userId,
        yearMonth,
        count: 1,
      },
      update: {
        count: { increment: 1 },
      },
    });
  }

  async getSyncCount(userId: string, yearMonth: string): Promise<number> {
    const usage = await this.prisma.syncUsage.findUnique({
      where: {
        userId_yearMonth: { userId, yearMonth },
      },
    });

    return usage?.count ?? 0;
  }

  private buildPlanInfo(
    plan: PlanTier,
    limits: PlanLimits,
    syncsUsed: number,
    yearMonth: string,
  ): UserPlanInfo {
    const syncsRemaining = Math.max(0, limits.maxSyncsPerMonth - syncsUsed);

    return {
      plan,
      label: limits.label,
      priceCents: limits.priceCents,
      maxSyncsPerMonth: limits.maxSyncsPerMonth,
      syncsUsed,
      syncsRemaining,
      canSync: syncsRemaining > 0,
      allowImport: limits.allowImport,
      yearMonth,
    };
  }
}
