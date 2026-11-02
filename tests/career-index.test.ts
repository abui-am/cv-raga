import { afterEach, expect, it, vi } from "vitest";
import { HttpError } from "../lib/server/http";
import {
  careerIndexRequest,
  rebuildCareerIndex,
} from "../lib/server/career-index";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("builds a POST /index request with the API key and no body", () => {
  const request = careerIndexRequest({
    CAREER_RAG_URL: "http://127.0.0.1:8000/",
    API_KEY: "secret",
  });
  expect(request).toEqual({
    url: "http://127.0.0.1:8000/index",
    method: "POST",
    headers: {
      Accept: "application/json",
      "X-API-Key": "secret",
    },
  });
  expect(request).not.toHaveProperty("body");
});

it("refuses to call career search when the URL or key is missing", () => {
  expect(() =>
    careerIndexRequest({ CAREER_RAG_URL: "", API_KEY: "secret" }),
  ).toThrow(HttpError);
  expect(() =>
    careerIndexRequest({ CAREER_RAG_URL: "http://127.0.0.1:8000" }),
  ).toThrow(/Career search is not configured/);
  expect(() => careerIndexRequest({})).toThrow(HttpError);
});

it("blocks shared indexing in private workspaces", async () => {
  vi.stubEnv("CAREER_RAG_URL", "http://127.0.0.1:8000");
  vi.stubEnv("API_KEY", "secret");
  const fetchImpl = vi
    .fn()
    .mockResolvedValue(new Response("no", { status: 503 }));
  await expect(rebuildCareerIndex(fetchImpl)).rejects.toBeInstanceOf(HttpError);
  expect(fetchImpl).not.toHaveBeenCalled();
});
