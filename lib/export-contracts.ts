import { z } from "zod";
export const CV_PAGE_LIMIT = 2;
// Leave normal print margins and a few lines of breathing room, not an empty half-page.
export const CV_MIN_PAGE_FILL = 0.94;
export const EXPORT_CHECK_VERSION = "ats-classic-layout-v5-languages";
export const exportCheckResultSchema = z.object({
  pdfPages: z.number().int(),
  maxPages: z.number().int(),
  pdfReadingOrder: z.boolean(),
  headingGroups: z.boolean(),
  docxReadingOrder: z.boolean(),
  passed: z.boolean(),
});
export const exportCheckSchema = z.object({
  id: z.string(),
  cvRevision: z.number().int(),
  version: z.string(),
  result: exportCheckResultSchema,
  createdAt: z.string(),
  stale: z.boolean(),
});
