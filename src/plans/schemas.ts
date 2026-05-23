import z from "zod";

export const PlanTierSchema = z.enum(["FREE", "STARTER", "PRO"]);

export const UserPlanInfoSchema = z.object({
  plan: PlanTierSchema,
  label: z.string(),
  priceCents: z.number(),
  maxSyncsPerMonth: z.number(),
  syncsUsed: z.number(),
  syncsRemaining: z.number(),
  canSync: z.boolean(),
  allowImport: z.boolean(),
  yearMonth: z.string(),
});

export type UserPlanInfoDto = z.infer<typeof UserPlanInfoSchema>;
