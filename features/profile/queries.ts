import { createQueryKeys } from "@lukemorales/query-key-factory";
import { profileApi } from "./api";
export const profileQueries = createQueryKeys("profile", {
  sources: {
    queryKey: null,
    queryFn: ({ signal }) => profileApi.sources(signal),
  },
  source: (id: string) => ({
    queryKey: [id],
    queryFn: ({ signal }) => profileApi.source(id, signal),
  }),
  detail: {
    queryKey: null,
    queryFn: ({ signal }) => profileApi.detail(signal),
  },
});
