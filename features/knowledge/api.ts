import { api } from "@/lib/http";
import {
  evidenceSchema,
  openQuestionSchema,
  type Evidence,
  type EvidenceInput,
} from "@/lib/contracts";
import { z } from "zod";
export const knowledgeApi = {
  delete: ({ id, revision }: Pick<Evidence, "id" | "revision">) =>
    api(`evidence/${id}`, z.object({ id: z.string() }), {
      method: "DELETE",
      body: { revision },
    }),
  list: (search: string, signal?: AbortSignal) =>
    api(
      `evidence?search=${encodeURIComponent(search)}`,
      evidenceSchema.array(),
      { signal },
    ),
  openQuestions: (signal?: AbortSignal) =>
    api("open-questions", openQuestionSchema.array(), { signal }),
  rebuildIndex: () =>
    api("career-index", z.object({ indexed: z.literal(true) }), {
      method: "POST",
    }),
  save: ({
    id,
    revision,
    openQuestionId,
    ...body
  }: EvidenceInput & {
    id?: string;
    revision: number;
    openQuestionId?: string;
  }) =>
    api(id ? `evidence/${id}` : "evidence", evidenceSchema, {
      method: id ? "PATCH" : "POST",
      body: { ...body, revision, openQuestionId },
    }),
};
