import "server-only";
import { HttpError } from "./http";

type CareerIndexEnv = {
  CAREER_RAG_URL?: string;
  API_KEY?: string;
};

export function careerIndexRequest(
  env: CareerIndexEnv = {
    CAREER_RAG_URL: process.env.CAREER_RAG_URL,
    API_KEY: process.env.API_KEY,
  },
) {
  const base = env.CAREER_RAG_URL?.trim().replace(/\/+$/, "");
  const key = env.API_KEY?.trim();
  if (!base || !key)
    throw new HttpError(
      503,
      "Career search is not configured. Add CAREER_RAG_URL and API_KEY to .env.local and restart the app.",
    );
  return {
    url: `${base}/index`,
    method: "POST" as const,
    headers: {
      Accept: "application/json",
      "X-API-Key": key,
    },
  };
}

export async function rebuildCareerIndex(fetchImpl: typeof fetch = fetch) {
  // The legacy career-rag API has no user-scoped indexing contract.
  // Never submit a shared index request from a private workspace.
  void fetchImpl;
  throw new HttpError(
    503,
    "Career search indexing is unavailable in a multi-user workspace.",
  );
}
