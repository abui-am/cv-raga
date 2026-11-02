import {
  createQueryKeys,
  mergeQueryKeys,
} from "@lukemorales/query-key-factory";
import { api } from "./http";
import { settingsSchema } from "./contracts";
import { profileQueries } from "@/features/profile/queries";
import { knowledgeQueries } from "@/features/knowledge/queries";
import { applicationQueries } from "@/features/applications/queries";
import { assessmentQueries, cvQueries } from "@/features/cvs/queries";
import { repositoryQueries } from "@/features/repositories/queries";
const settings = createQueryKeys("settings", {
  detail: {
    queryKey: null,
    queryFn: ({ signal }) => api("settings", settingsSchema, { signal }),
  },
});
export const queries = mergeQueryKeys(
  settings,
  profileQueries,
  knowledgeQueries,
  applicationQueries,
  cvQueries,
  assessmentQueries,
  repositoryQueries,
);
