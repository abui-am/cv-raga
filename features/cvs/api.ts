import { api } from "@/lib/http";
import { ApiError } from "@/lib/http";
import { cvSchema, type CvContent } from "@/lib/contracts";
export const cvsApi = {
  proposalPdf: async (id: string, revision: number, signal?: AbortSignal) => {
    const response = await fetch(
      `/api/cvs/${id}/proposal-preview?revision=${revision}`,
      { signal, cache: "no-store" },
    );
    if (!response.ok)
      throw new ApiError(
        response.status,
        "The proposal preview could not be loaded. Regenerate it if the CV changed.",
      );
    return response.arrayBuffer();
  },
  pdf: async (id: string, revision: number, signal?: AbortSignal) => {
    const response = await fetch(
      `/api/cvs/${id}/preview?revision=${revision}`,
      { signal, cache: "no-store" },
    );
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("application/pdf")
    )
      throw new ApiError(
        response.status || 502,
        "The PDF preview could not be loaded. Try again.",
      );
    return response.arrayBuffer();
  },
  list: (signal?: AbortSignal) => api("cvs", cvSchema.array(), { signal }),
  detail: (id: string, signal?: AbortSignal) =>
    api(`cvs/${id}`, cvSchema, { signal }),
  create: (body: {
    title: string;
    applicationId: string | null;
    baseCvId: string | null;
  }) => api("cvs", cvSchema, { method: "POST", body }),
  save: ({
    id,
    ...body
  }: {
    id: string;
    revision: number;
    content: CvContent;
  }) => api(`cvs/${id}`, cvSchema, { method: "PATCH", body }),
  action: ({
    id,
    action,
    ...body
  }: {
    id: string;
    action:
      | "tailor"
      | "assess"
      | "restore"
      | "suggestion"
      | "letter-generate"
      | "persona-review"
      | "review-apply"
      | "assistant"
      | "optimize-match"
      | "accept-all"
      | "export-check";
    revision?: number;
    number?: number;
    suggestionId?: string;
    decision?: "accept" | "reject" | "undo";
    text?: string;
    reviewId?: string;
    message?: string;
    mode?: "refine" | "question";
    saveKnowledge?: boolean;
    perspective?: "Combined" | "HR" | "TeamLead" | "Management";
  }) => api(`cvs/${id}/${action}`, cvSchema, { method: "POST", body }),
  saveLetter: ({
    id,
    ...body
  }: {
    id: string;
    content: import("@/lib/review-contracts").CoverLetterContent;
    baseNumber: number;
    cvRevision: number;
    postingRevision: number;
  }) => api(`cvs/${id}/letter-save`, cvSchema, { method: "POST", body }),
};
