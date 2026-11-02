import { createQueryKeys } from "@lukemorales/query-key-factory";
import { repositoriesApi } from "./api";
export const repositoryQueries = createQueryKeys("repositories", {
  list: {
    queryKey: null,
    queryFn: ({ signal }) => repositoriesApi.list(signal),
  },
  browse: (path: string | null) => ({
    queryKey: [path || "home"],
    queryFn: ({ signal }) => repositoriesApi.browse(path, signal),
  }),
});
