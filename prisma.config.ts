import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Generation and builds do not require a running database or local secrets.
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5433/cvraga",
  },
});
