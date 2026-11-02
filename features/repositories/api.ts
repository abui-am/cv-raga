import { z } from "zod";
import { api } from "@/lib/http";
import {
  folderListingSchema,
  repositorySchema,
  repositorySearchSchema,
} from "@/lib/repository-contracts";
export const repositoriesApi = {
  list: (signal?: AbortSignal) =>
    api("repositories", repositorySchema.array(), { signal }),
  browse: (path: string | null, signal?: AbortSignal) =>
    api(
      `repositories/browse${path ? `?${new URLSearchParams({ path })}` : ""}`,
      folderListingSchema,
      { signal },
    ),
  connect: (path: string) =>
    api("repositories", repositorySchema, { method: "POST", body: { path } }),
  disconnect: (id: string) =>
    api(
      `repositories/${id}/disconnect`,
      z.object({ disconnected: z.boolean() }),
      { method: "POST", body: {} },
    ),
  search: ({ id, query }: { id: string; query?: string }) =>
    api(`repositories/${id}/search`, repositorySearchSchema, {
      method: "POST",
      body: { query },
    }),
};
