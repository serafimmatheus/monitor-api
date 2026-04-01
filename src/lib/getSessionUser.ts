import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";

import { auth } from "./auth.js";

export type SessionUser = { id: string; email: string; name?: string | null };

export async function getSessionUser(
  request: FastifyRequest,
): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}
