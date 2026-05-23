import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { requireSessionUser } from "../../lib/requireSessionUser.js";
import { sendDomainRouteError } from "../../lib/sendDomainRouteError.js";
import { ErrorSchema } from "../../schemas/ErrorSchema.js";
import { SyncResponseSchema } from "../../clients/schemas.js";
import type { EnqueueSync } from "../../clients/UseCases/EnqueueSync.js";

const err = {
  400: ErrorSchema,
  401: ErrorSchema,
  404: ErrorSchema,
  409: ErrorSchema,
  500: ErrorSchema,
} as const;

export type SyncRouteDeps = {
  enqueueSync: EnqueueSync;
};

export const syncRoutes: FastifyPluginAsync<SyncRouteDeps> = async (
  app,
  deps,
) => {
  app.addHook("preHandler", requireSessionUser);

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      operationId: "syncClients",
      tags: ["Sincronizacao"],
      response: { 200: SyncResponseSchema, ...err },
    },
    handler: async (_request, reply) => {
      try {
        const result = await deps.enqueueSync.execute();
        return reply.send({
          queued: result.queued,
          message: "Sincronizacao iniciada",
        });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });
};
