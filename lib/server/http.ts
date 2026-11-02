import "server-only";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireValue<T>(
  value: T | null | undefined,
  message = "Record not found",
): T {
  if (value == null) throw new HttpError(404, message);
  return value;
}
export function wire<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}
export async function readBody(
  request: Request,
  limit = 1024 * 1024,
): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new HttpError(413, "File or request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body is empty");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new HttpError(413, "File or request is too large.");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
}
export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(await readBody(request)));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON request");
  }
}
export function checkWriteOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  // Next's internal Request URL can use localhost even when the browser used 127.0.0.1.
  // Validate the actual Host authority, without trusting forwarded host headers.
  const url = new URL(
    `${requestUrl.protocol}//${request.headers.get("host") || requestUrl.host}`,
  );
  const allowedOrigin = process.env.BETTER_AUTH_URL
    ? new URL(process.env.BETTER_AUTH_URL).origin
    : url.origin;
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== allowedOrigin) ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    request.headers.get("x-cvraga") !== "1"
  ) {
    throw new HttpError(
      403,
      "This request must come from your CVRaga workspace.",
    );
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  // Never return database URLs, document contents, SDK internals or keys to the browser.
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  if (code === "P2025")
    return Response.json({ error: "Record not found" }, { status: 404 });
  if (code === "P2002")
    return Response.json(
      { error: "This record changed. Reload before trying again." },
      { status: 409 },
    );
  console.error("CVRaga request failed", {
    kind: error instanceof Error ? error.name : "Unknown",
    code,
  });
  return Response.json(
    {
      error:
        "The request could not be completed. Check PostgreSQL is running and try again.",
    },
    { status: 503 },
  );
}
