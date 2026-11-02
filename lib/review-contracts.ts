import { z } from "zod";
const id = z.string().min(1).max(100);
const short = z.string().max(500);
export const coverLetterContentSchema = z.object({
  recipient: short.min(1),
  subject: short.min(1),
  paragraphs: z.array(z.string().trim().min(1).max(2000)).min(1).max(6),
  closing: short.min(1),
});
export type CoverLetterContent = z.infer<typeof coverLetterContentSchema>;
export const coverLetterSchema = z.object({
  id,
  number: z.number().int(),
  cvRevision: z.number().int(),
  postingRevision: z.number().int(),
  content: coverLetterContentSchema,
  status: z.enum(["draft", "accepted"]),
  evidenceQuotes: z.array(z.string()),
  stale: z.boolean(),
  createdAt: z.string(),
});
export type CoverLetter = z.infer<typeof coverLetterSchema>;
export const PERSONA_RUBRIC = "career-review-v1";
export const personas = ["HR", "TeamLead", "Management"] as const;
export const personaSchema = z.enum(personas);
export const criterionIds = [
  "hr_requirements",
  "hr_clarity",
  "hr_letter",
  "tl_technical",
  "tl_quality",
  "tl_ownership",
  "mg_impact",
  "mg_collaboration",
  "mg_alignment",
] as const;
export const personaResultSchema = z.object({
  summary: z.string().min(1).max(1500),
  criteria: z
    .array(
      z.object({
        id: z.enum(criterionIds),
        status: z.enum(["evident", "partial", "not_evident", "not_assessed"]),
        document: z.enum(["cv", "cover_letter", "none"]),
        quote: z.string().max(2000),
        observation: z.string().min(1).max(1500),
        nextStep: z.string().max(1500),
      }),
    )
    .length(3),
});
export type PersonaResult = z.infer<typeof personaResultSchema>;
export const personaOutcomeSchema = z.object({
  persona: personaSchema,
  result: personaResultSchema.nullable(),
  error: z.string().nullable(),
});
export const reviewRunSchema = z.object({
  id,
  cvRevision: z.number().int(),
  postingRevision: z.number().int(),
  coverLetterId: id.nullable(),
  rubric: short,
  model: short,
  results: z.array(personaOutcomeSchema).length(3),
  improvement: z
    .object({
      status: z.enum([
        "ready",
        "pending",
        "applied",
        "unchanged",
        "failed",
        "skipped",
      ]),
      cvRevision: z.number().int().nullable(),
      error: z.string().nullable(),
    })
    .nullable()
    .default(null),
  stale: z.boolean(),
  createdAt: z.string(),
});
export type ReviewRun = z.infer<typeof reviewRunSchema>;
