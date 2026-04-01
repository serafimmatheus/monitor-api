import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { getSessionUser } from "../../lib/getSessionUser.js";
import { sendDomainRouteError } from "../../lib/sendDomainRouteError.js";
import { ErrorSchema } from "../../schemas/ErrorSchema.js";
import {
  ConsumeSupplyBodySchema,
  ConsumeSupplyResponseSchema,
} from "../schemas.js";
import type { ConsumeSupply } from "../UseCases/ConsumeSupply.js";

interface SuppliesRoutesOptions {
  consumeSupply: ConsumeSupply;
}

export const suppliesRoutes: FastifyPluginAsync<SuppliesRoutesOptions> = async (
  app,
  opts,
) => {
  const { consumeSupply } = opts;

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "PATCH",
    url: "/consume",
    schema: {
      operationId: "consumeSupply",
      tags: ["Supplies"],
      summary: "Registrar consumo de insumo",
      description:
        "Cria um CareEvent de consumo, decrementa o estoque do Supply e indica se o estoque atingiu o mínimo.",
      body: ConsumeSupplyBodySchema,
      response: {
        200: ConsumeSupplyResponseSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      const user = await getSessionUser(request);
      if (!user) {
        return reply.status(401).send({
          message: "Não autorizado",
          code: "UNAUTHORIZED",
        });
      }
      try {
        const { patientId, supplyId, quantity, notes } = request.body;
        const result = await consumeSupply.execute({
          userId: user.id,
          patientId,
          supplyId,
          quantity,
          notes,
        });
        return reply.status(200).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });
};
