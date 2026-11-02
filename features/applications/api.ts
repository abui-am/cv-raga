import { api } from "@/lib/http";
import {
  applicationSchema,
  cvSchema,
  type ApplicationInput,
} from "@/lib/contracts";
export type ApplicationFilters = { search: string; status: string };
export const applicationsApi = {
  createCv: ({
    id,
    ...body
  }: {
    id: string;
    baseCvId: string | null;
    postingRevision: number;
  }) => api(`applications/${id}/create-cv`, cvSchema, { method: "POST", body }),
  list: (filters: ApplicationFilters, signal?: AbortSignal) =>
    api(
      `applications?${new URLSearchParams(filters)}`,
      applicationSchema.array(),
      { signal },
    ),
  detail: (id: string, signal?: AbortSignal) =>
    api(`applications/${id}`, applicationSchema, { signal }),
  save: ({
    id,
    revision,
    ...body
  }: ApplicationInput & { id?: string; revision: number }) =>
    api(id ? `applications/${id}` : "applications", applicationSchema, {
      method: id ? "PATCH" : "POST",
      body: { ...body, revision },
    }),
  analyze: (id: string) =>
    api(`applications/${id}/analyze`, applicationSchema, {
      method: "POST",
      body: {},
    }),
};
