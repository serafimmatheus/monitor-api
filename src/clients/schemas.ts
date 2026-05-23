import z from "zod";

export const DocumentTypeSchema = z.enum(["CNPJ", "CPF"]);

export const ClientDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  document: z.string(),
  documentType: DocumentTypeSchema,
  status: z.string(),
  updatedAt: z.string(),
});

export const ClientStatusSchema = z.enum([
  "ATIVA",
  "PENDENTE",
  "BAIXADA",
  "INAPTA",
  "SUSPENSA",
  "ERRO",
]);

export const ListClientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return undefined;

      const statuses = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const parsed = statuses.filter(
        (item): item is z.infer<typeof ClientStatusSchema> =>
          ClientStatusSchema.safeParse(item).success,
      );

      return parsed.length > 0 ? parsed : undefined;
    }),
});

export const PaginationSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export const ListClientsResponseSchema = z.object({
  data: z.array(ClientDtoSchema),
  pagination: PaginationSchema,
});

export const ClientsSummaryResponseSchema = z.object({
  ativos: z.number(),
  pendentes: z.number(),
  baixadas: z.number(),
  inaptos: z.number(),
  totalCnpj: z.number(),
  pendingCnpj: z.number(),
  hasPendingSync: z.boolean(),
});

export const ClientIdParamsSchema = z.object({
  clientId: z.string(),
});

export const CreateClientBodySchema = z.object({
  name: z.string().trim().min(1, "Nome e obrigatorio"),
  email: z.email("Email invalido"),
  document: z.string().trim().min(1, "CNPJ ou CPF e obrigatorio"),
});

export const UpdateClientBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.email().optional(),
    document: z.string().trim().min(1).optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.email !== undefined ||
      body.document !== undefined,
    { message: "Informe ao menos um campo para atualizar" },
  );

export const ClientResponseSchema = z.object({
  client: ClientDtoSchema,
});

export const OkResponseSchema = z.object({
  ok: z.literal(true),
});

export const ImportClientsResponseSchema = z.object({
  imported: z.number(),
  skipped: z.number(),
  errors: z.array(
    z.object({
      row: z.number(),
      message: z.string(),
    }),
  ),
});

export const SyncResponseSchema = z.object({
  queued: z.number(),
  message: z.string(),
});

export type ClientDto = z.infer<typeof ClientDtoSchema>;
