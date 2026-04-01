import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { openAPI } from "better-auth/plugins";

import { claimPendingCaregiverInvites } from "../patients/UseCases/claimPendingCaregiverInvites.js";
import { prisma } from "./db.js";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5555",
  trustedOrigins: ["http://localhost:3000"],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (user.email) {
            await claimPendingCaregiverInvites(prisma, user.id, user.email);
          }
        },
      },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [openAPI()],
});
