import { createQueryKeys } from "@lukemorales/query-key-factory";
import { applicationsApi, type ApplicationFilters } from "./api";
export const applicationQueries = createQueryKeys("applications", {
  list: (filters: ApplicationFilters) => ({
    queryKey: [{ search: filters.search.trim(), status: filters.status }],
    queryFn: ({ signal }) =>
      applicationsApi.list(
        { search: filters.search.trim(), status: filters.status },
        signal,
      ),
  }),
  detail: (id: string) => ({
    queryKey: [id],
    queryFn: ({ signal }) => applicationsApi.detail(id, signal),
  }),
});
