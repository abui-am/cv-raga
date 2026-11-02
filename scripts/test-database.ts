import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL)
  throw new Error("Set up .env.local and start PostgreSQL first.");
const url = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname))
  throw new Error("Tests require local PostgreSQL.");
const admin = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url.toString(), max: 1 }),
});
try {
  const existing = await admin.$queryRaw<
    { datname: string }[]
  >`SELECT datname FROM pg_database WHERE datname = 'cvraga_test'`;
  if (!existing.length)
    await admin.$executeRawUnsafe('CREATE DATABASE "cvraga_test"');
} finally {
  await admin.$disconnect();
}
url.pathname = "/cvraga_test";
const result = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url.toString() },
});
process.exitCode = result.status ?? 1;
