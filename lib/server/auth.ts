import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { authDatabase } from "./db";

let auth: ReturnType<typeof createAuth> | undefined;
function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !baseURL)
    throw new Error(
      "Set BETTER_AUTH_SECRET (at least 32 characters) and BETTER_AUTH_URL.",
    );
  return betterAuth({
    appName: "CVRaga",
    secret,
    baseURL,
    database: prismaAdapter(authDatabase(), { provider: "postgresql" }),
    emailAndPassword: { enabled: true, disableSignUp: true },
    session: { expiresIn: 60 * 60 * 24 * 7 },
    rateLimit: { enabled: true, storage: "database" },
    plugins: [
      magicLink({
        expiresIn: 60 * 10,
        storeToken: "hashed",
        rateLimit: { window: 60, max: 3 },
        async sendMagicLink({ email, url }) {
          const key = process.env.RESEND_API_KEY;
          const from = process.env.RESEND_FROM_EMAIL;
          if (!key || !from) throw new Error("Resend email is not configured.");
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from,
              to: [email],
              subject: "Sign in to CVRaga",
              text: `Sign in to your private CVRaga workspace:\n\n${url}\n\nThis link expires in 10 minutes and can only be used once. If you did not request it, ignore this email.`,
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) throw new Error("Sign-in email could not be sent.");
        },
      }),
    ],
  });
}
export function getAuth() {
  return (auth ??= createAuth());
}
