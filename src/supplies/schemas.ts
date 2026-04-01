import z from "zod";

export const ConsumeSupplyBodySchema = z.object({
  patientId: z.string().cuid(),
  supplyId: z.string().cuid(),
  quantity: z.coerce
    .number()
    .int()
    .positive({ message: "A quantidade consumida deve ser um inteiro positivo" }),
  notes: z.string().max(2000).optional(),
});

export const ConsumeSupplyResponseSchema = z.object({
  supply: z.object({
    id: z.string().cuid(),
    patientId: z.string().cuid(),
    name: z.string(),
    currentQuantity: z.number().int(),
    minQuantity: z.number().int(),
    unit: z.string(),
    updatedAt: z.string().datetime(),
  }),
  careEventId: z.string().cuid(),
  lowStockWarning: z.boolean(),
  warningMessage: z.string().optional(),
});
