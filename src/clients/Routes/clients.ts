import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { requireSessionUser } from "../../lib/requireSessionUser.js";
import { sendDomainRouteError } from "../../lib/sendDomainRouteError.js";
import { ErrorSchema } from "../../schemas/ErrorSchema.js";
import { ListClientsResponseSchema } from "../schemas.js";
import type { ListClients } from "../UseCases/ClientCrud.js";

const err = {
  400: ErrorSchema,
  401: ErrorSchema,
  404: ErrorSchema,
  409: ErrorSchema,
  500: ErrorSchema,
} as const;

export type ClientRouteDeps = {
  listClients: ListClients;
};

export const clientRoutes: FastifyPluginAsync<ClientRouteDeps> = async (
  app,
  deps,
) => {
  app.addHook("preHandler", requireSessionUser);

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      operationId: "listClients",
      tags: ["Clientes"],
      response: { 200: ListClientsResponseSchema, ...err },
    },
    handler: async (_request, reply) => {
      try {
        const clients = await deps.listClients.execute();
        return reply.send(clients);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });
};
