import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T extends z.ZodType>(
  path: string,
  schema: T,
  options: {
    method?: "POST" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<z.output<T>> {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`/api/${path}`, {
    method: options.method || "GET",
    signal: options.signal,
    cache: "no-store",
    headers: options.method
      ? {
          "x-cvraga": "1",
          ...(isForm ? {} : { "content-type": "application/json" }),
        }
      : undefined,
    body:
      options.body === undefined
        ? undefined
        : isForm
          ? (options.body as FormData)
          : JSON.stringify(options.body),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(data);
    throw new ApiError(
      response.status,
      error.success ? error.data.error : "The request failed. Try again.",
    );
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new ApiError(
      502,
      "The server returned an unexpected result. Reload and try again.",
    );
  return parsed.data;
}
