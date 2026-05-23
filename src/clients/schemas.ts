import z from "zod";

export const ClientDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  cnpj: z.string(),
  status: z.string(),
  updatedAt: z.string(),
});

export const ListClientsResponseSchema = z.array(ClientDtoSchema);

export const SyncResponseSchema = z.object({
  queued: z.number(),
  message: z.string(),
});

export type ClientDto = z.infer<typeof ClientDtoSchema>;
