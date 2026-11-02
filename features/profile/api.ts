import { api } from "@/lib/http";
import {
  cvContentSchema,
  profileSchema,
  sourceSchema,
  sourceSummarySchema,
  type CvContent,
} from "@/lib/contracts";

export const profileApi = {
  sources: (signal?: AbortSignal) =>
    api("sources", sourceSummarySchema.array(), { signal }),
  source: (id: string, signal?: AbortSignal) =>
    api(`sources/${id}`, sourceSchema, { signal }),
  detail: (signal?: AbortSignal) =>
    api("profile", profileSchema.nullable(), { signal }),
  save: (body: { revision: number; content: CvContent }) =>
    api("profile", profileSchema, { method: "POST", body }),
  import: (file: File) => {
    const body = new FormData();
    body.set("file", file);
    return api("sources", sourceSchema, { method: "POST", body });
  },
  paste: (body: { name: string; text: string }) =>
    api("sources", sourceSchema, { method: "POST", body }),
  extract: (id: string) =>
    api(`sources/${id}/extract`, cvContentSchema, { method: "POST", body: {} }),
};
