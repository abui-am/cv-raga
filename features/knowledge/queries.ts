import { createQueryKeys } from "@lukemorales/query-key-factory";
import { knowledgeApi } from "./api";
export const knowledgeQueries = createQueryKeys("knowledge", {
  list: (search: string) => ({
    queryKey: [search.trim()],
    queryFn: ({ signal }) => knowledgeApi.list(search.trim(), signal),
  }),
  open: {
    queryKey: null,
    queryFn: ({ signal }) => knowledgeApi.openQuestions(signal),
  },
  detail: (id: string) => [id],
});
