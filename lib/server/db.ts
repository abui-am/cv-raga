import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { workspaceId } from "./workspace";
import { scopeOperation } from "./workspace-scope";

const globalDb = globalThis as unknown as { cvragaDb?: PrismaClient };

// The unscoped client is reserved for the authentication library.
export function authDatabase() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL is missing. Follow README setup to start PostgreSQL.",
    );
  return (globalDb.cvragaDb ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    }),
  }));
}
export function database() {
  const ownerId = workspaceId();
  return authDatabase().$extends({
    name: "private-workspace",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          scopeOperation(model, operation, args, ownerId);
          return query(args);
        },
      },
    },
  });
}
