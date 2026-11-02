import { z } from "zod";
export const repositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  createdAt: z.string(),
});
export type Repository = z.infer<typeof repositorySchema>;
export const folderListingSchema = z.object({
  path: z.string(),
  parent: z.string().nullable(),
  root: z.string(),
  isRepository: z.boolean(),
  folders: z.array(
    z.object({ name: z.string(), path: z.string(), isRepository: z.boolean() }),
  ),
});
export const repositorySearchSchema = z.object({
  created: z.number().int(),
  skipped: z.number().int(),
  scanned: z.number().int(),
  matches: z.number().int(),
});
