import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { requireSessionUser } from "../../lib/requireSessionUser.js";
import { sendDomainRouteError } from "../../lib/sendDomainRouteError.js";
import { ErrorSchema } from "../../schemas/ErrorSchema.js";
import {
  ClientIdParamsSchema,
  ClientResponseSchema,
  CreateClientBodySchema,
  ImportClientsResponseSchema,
  ListClientsResponseSchema,
  OkResponseSchema,
  UpdateClientBodySchema,
} from "../schemas.js";
import type {
  CreateClient,
  DeleteClient,
  GetClient,
  ListClients,
  UpdateClient,
} from "../UseCases/ClientCrud.js";
import type { ImportClientsFromSpreadsheet } from "../UseCases/ImportClients.js";

const err = {
  400: ErrorSchema,
  401: ErrorSchema,
  404: ErrorSchema,
  409: ErrorSchema,
  500: ErrorSchema,
} as const;

function isPrismaUniqueError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

export type ClientRouteDeps = {
  listClients: ListClients;
  getClient: GetClient;
  createClient: CreateClient;
  updateClient: UpdateClient;
  deleteClient: DeleteClient;
  importClientsFromSpreadsheet: ImportClientsFromSpreadsheet;
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

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      operationId: "createClient",
      tags: ["Clientes"],
      body: CreateClientBodySchema,
      response: { 201: ClientResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const client = await deps.createClient.execute(request.body);
        return reply.status(201).send({ client });
      } catch (error) {
        if (isPrismaUniqueError(error)) {
          return reply.status(409).send({
            message: "Ja existe um cliente com esse CNPJ ou CPF",
            code: "CONFLICT",
          });
        }
        if (error instanceof Error && error.message.includes("invalido")) {
          return reply.status(400).send({
            message: error.message,
            code: "VALIDATION_ERROR",
          });
        }
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/import",
    schema: {
      operationId: "importClients",
      tags: ["Clientes"],
      consumes: ["multipart/form-data"],
      response: { 200: ImportClientsResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const file = await request.file();

        if (!file) {
          return reply.status(400).send({
            message: "Arquivo nao enviado",
            code: "VALIDATION_ERROR",
          });
        }

        const buffer = await file.toBuffer();
        const result = await deps.importClientsFromSpreadsheet.execute(buffer);
        return reply.send(result);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Planilha")) {
          return reply.status(400).send({
            message: error.message,
            code: "VALIDATION_ERROR",
          });
        }
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:clientId",
    schema: {
      operationId: "getClient",
      tags: ["Clientes"],
      params: ClientIdParamsSchema,
      response: { 200: ClientResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const client = await deps.getClient.execute(request.params.clientId);
        if (!client) {
          return reply.status(404).send({
            message: "Cliente nao encontrado",
            code: "NOT_FOUND",
          });
        }
        return reply.send({ client });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "PATCH",
    url: "/:clientId",
    schema: {
      operationId: "updateClient",
      tags: ["Clientes"],
      params: ClientIdParamsSchema,
      body: UpdateClientBodySchema,
      response: { 200: ClientResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const client = await deps.updateClient.execute(
          request.params.clientId,
          request.body,
        );
        if (!client) {
          return reply.status(404).send({
            message: "Cliente nao encontrado",
            code: "NOT_FOUND",
          });
        }
        return reply.send({ client });
      } catch (error) {
        if (isPrismaUniqueError(error)) {
          return reply.status(409).send({
            message: "Ja existe um cliente com esse CNPJ ou CPF",
            code: "CONFLICT",
          });
        }
        if (error instanceof Error && error.message.includes("invalido")) {
          return reply.status(400).send({
            message: error.message,
            code: "VALIDATION_ERROR",
          });
        }
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "DELETE",
    url: "/:clientId",
    schema: {
      operationId: "deleteClient",
      tags: ["Clientes"],
      params: ClientIdParamsSchema,
      response: { 200: OkResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const ok = await deps.deleteClient.execute(request.params.clientId);
        if (!ok) {
          return reply.status(404).send({
            message: "Cliente nao encontrado",
            code: "NOT_FOUND",
          });
        }
        return reply.send({ ok: true as const });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });
};
