import { createQueryKeys } from "@lukemorales/query-key-factory";
import { cvsApi } from "./api";
export const cvQueries = createQueryKeys("cvs", {
  proposal: (id: string, revision: number, suggestionIds: string[]) => ({
    queryKey: [id, revision, suggestionIds],
    queryFn: ({ signal }) => cvsApi.proposalPdf(id, revision, signal),
  }),
  pdf: (id: string, revision: number) => ({
    queryKey: [id, revision],
    queryFn: ({ signal }) => cvsApi.pdf(id, revision, signal),
  }),
  list: { queryKey: null, queryFn: ({ signal }) => cvsApi.list(signal) },
  detail: (id: string) => ({
    queryKey: [id],
    queryFn: ({ signal }) => cvsApi.detail(id, signal),
  }),
});
// Saved assessments are part of a CV record; keys also identify the exact scoring inputs.
export const assessmentQueries = createQueryKeys("assessments", {
  detail: (
    cvId: string,
    cvRevision: number,
    postingRevision: number,
    rubric: string,
  ) => ({
    queryKey: [cvId, cvRevision, postingRevision, rubric],
    queryFn: async ({ signal }) =>
      (await cvsApi.detail(cvId, signal)).assessments.filter(
        (a) =>
          a.cvRevision === cvRevision &&
          a.postingRevision === postingRevision &&
          a.rubric === rubric &&
          !a.stale,
      ),
  }),
});
