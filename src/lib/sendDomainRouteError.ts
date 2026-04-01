import type { FastifyBaseLogger, FastifyReply } from "fastify";

import { ErrorBadRequest } from "../errors/ErrorBadRequest.js";
import { ErrorConflict } from "../errors/ErrorConflict.js";
import { ErrorForbidden } from "../errors/ErrorForbidden.js";
import { ErrorNotFound } from "../errors/ErrorNotFound.js";

export function sendDomainRouteError(
  log: FastifyBaseLogger,
  reply: FastifyReply,
  error: unknown,
): FastifyReply {
  if (error instanceof ErrorNotFound) {
    return reply.status(404).send({
      message: error.message,
      code: "NOT_FOUND",
    });
  }
  if (error instanceof ErrorForbidden) {
    return reply.status(403).send({
      message: error.message,
      code: "FORBIDDEN",
    });
  }
  if (error instanceof ErrorBadRequest) {
    return reply.status(400).send({
      message: error.message,
      code: "BAD_REQUEST",
    });
  }
  if (error instanceof ErrorConflict) {
    return reply.status(409).send({
      message: error.message,
      code: "CONFLICT",
    });
  }
  log.error(error);
  return reply.status(500).send({
    message: "Erro interno do servidor",
    code: "INTERNAL_SERVER_ERROR",
  });
}
