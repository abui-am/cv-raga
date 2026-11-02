import { config } from "dotenv";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first.");
const url = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname))
  throw new Error("Tests require local PostgreSQL.");
url.pathname = "/cvraga_test";
const repositoryRoot = resolve(".data/test-repositories");
await mkdir(repositoryRoot, { recursive: true });
const child = spawn(
  "pnpm",
  ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", "3100"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: url.toString(),
      OPENAI_API_KEY: "",
      CAREER_RAG_URL: "",
      API_KEY: "",
      CVRAGA_TEST_SERVER: "1",
      CVRAGA_REPOSITORY_ROOT: repositoryRoot,
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    child.kill(signal);
  });
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
