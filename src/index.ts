import "dotenv/config";

import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import fastifySwagger from "@fastify/swagger";
import fastifyApiReference from "@scalar/fastify-api-reference";
import Fastify from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";

import { clientRoutes } from "./clients/Routes/clients.js";
import {
  CreateClient,
  DeleteClient,
  GetClient,
  GetClientsSummary,
  ListClients,
  UpdateClient,
} from "./clients/UseCases/ClientCrud.js";
import { ImportClientsFromSpreadsheet } from "./clients/UseCases/ImportClients.js";
import { EnqueueSync } from "./clients/UseCases/EnqueueSync.js";
import { auth } from "./lib/auth.js";
import { prisma } from "./lib/db.js";
import { trustedFrontendOrigins } from "./lib/trustedOrigins.js";
import { planRoutes } from "./plans/Routes/plan.js";
import { PlanService } from "./plans/UseCases/PlanService.js";
import { syncRoutes } from "./sync/Routes/sync.js";

const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Monitor CNPJ API",
      description:
        "API para monitoramento de situacao cadastral de CNPJs via BrasilAPI.",
      version: "1.0.0",
    },
    servers: [
      {
        description: "Localhost",
        url: `http://localhost:${process.env.PORT || 5555}`,
      },
    ],
  },
  transform: jsonSchemaTransform,
});

const apiPort = Number(process.env.PORT) || 5555;
const corsStaticOrigins = new Set([
  `http://localhost:${apiPort}`,
  `http://127.0.0.1:${apiPort}`,
  ...trustedFrontendOrigins(),
]);

await app.register(fastifyMultipart, {
  limits: { fileSize: 5 * 1024 * 1024 },
});

await app.register(fastifyCors, {
  origin: (origin, cb) => {
    if (!origin) {
      cb(null, true);
      return;
    }
    if (corsStaticOrigins.has(origin)) {
      cb(null, true);
      return;
    }
    const allowLanDev =
      process.env.NODE_ENV !== "production" ||
      process.env.CORS_ALLOW_LAN === "1";
    if (
      allowLanDev &&
      /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
        origin,
      )
    ) {
      cb(null, true);
      return;
    }
    cb(null, false);
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  exposedHeaders: ["set-auth-token"],
});

await app.register(fastifyApiReference, {
  routePrefix: "/api",
  configuration: {
    sources: [
      {
        title: "Monitor CNPJ API",
        slug: "monitor-cnpj-api",
        url: "/swagger.json",
      },
      {
        title: "Auth API",
        slug: "auth-api",
        url: "/api/auth/open-api/generate-schema",
      },
    ],
  },
});

const planService = new PlanService(prisma);

const clientDeps = {
  listClients: new ListClients(prisma),
  getClientsSummary: new GetClientsSummary(prisma),
  getClient: new GetClient(prisma),
  createClient: new CreateClient(prisma),
  updateClient: new UpdateClient(prisma),
  deleteClient: new DeleteClient(prisma),
  importClientsFromSpreadsheet: new ImportClientsFromSpreadsheet(
    prisma,
    planService,
  ),
};

const syncDeps = {
  enqueueSync: new EnqueueSync(prisma, planService),
};

const planDeps = {
  planService,
};

await app.register(clientRoutes, {
  prefix: "/clients",
  ...clientDeps,
});

await app.register(syncRoutes, {
  prefix: "/sync",
  ...syncDeps,
});

await app.register(planRoutes, {
  prefix: "/me/plan",
  ...planDeps,
});

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/health",
  schema: {
    operationId: "healthCheck",
    hide: true,
  },
  handler: async () => ({ status: "ok" }),
});

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/swagger.json",
  schema: {
    operationId: "getSwaggerJson",
    hide: true,
  },
  handler: async () => {
    return app.swagger();
  },
});

app.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  schema: {
    hide: true,
  },
  async handler(request, reply) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) headers.append(key, value.toString());
      });
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.send(response.body ? await response.text() : null);
    } catch (error) {
      app.log.error(error);
      reply.status(500).send({
        error: "Internal authentication error.",
        code: "AUTH_FAILURE",
      });
    }
  },
});

try {
  const host = process.env.HOST?.trim() || "0.0.0.0";
  await app.listen({ port: apiPort, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
