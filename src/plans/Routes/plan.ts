import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { requireSessionUser } from "../../lib/requireSessionUser.js";
import { sendDomainRouteError } from "../../lib/sendDomainRouteError.js";
import { ErrorSchema } from "../../schemas/ErrorSchema.js";
import { UserPlanInfoSchema } from "../schemas.js";
import type { PlanService } from "../UseCases/PlanService.js";

const err = {
  401: ErrorSchema,
  500: ErrorSchema,
} as const;

export type PlanRouteDeps = {
  planService: PlanService;
};

export const planRoutes: FastifyPluginAsync<PlanRouteDeps> = async (
  app,
  deps,
) => {
  app.addHook("preHandler", requireSessionUser);

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      operationId: "getMyPlan",
      tags: ["Plano"],
      response: { 200: UserPlanInfoSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const planInfo = await deps.planService.getUserPlanInfo(
          request.sessionUser!.id,
        );
        return reply.send(planInfo);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });
};
