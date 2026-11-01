import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

const trustedOrigins = Array.from(
  new Set(
    [
      process.env.BETTER_AUTH_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ].filter((origin): origin is string => Boolean(origin))
  )
);

export const auth = betterAuth({
  appName: "ArzurVault",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  trustedOrigins,
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
