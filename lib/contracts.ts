import { z } from "zod";
import { coverLetterSchema, reviewRunSchema } from "./review-contracts";
import { exportCheckSchema } from "./export-contracts";

const text = z.string().max(20000);
const short = z.string().max(500);
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, "Use a valid identifier");
const lines = z.array(short).max(100);
export const workModeSchema = z.enum(["", "Remote", "On-site", "Hybrid"]);

export const cvContentSchema = z.object({
  name: short,
  headline: short,
  email: short,
  phone: short,
  location: short,
  links: lines,
  summary: text,
  skills: lines,
  languages: lines.optional(),
  experience: z
    .array(
      z.object({
        id,
        role: short,
        company: short,
        period: short,
        employmentType: short.optional(),
        workMode: workModeSchema.optional(),
        location: short.optional(),
        bullets: z.array(text).max(40),
      }),
    )
    .max(30),
  education: z
    .array(
      z.object({ id, institution: short, qualification: short, period: short }),
    )
    .max(20),
  projects: z
    .array(
      z.object({
        id,
        name: short,
        detail: short,
        bullets: z.array(text).max(30),
      }),
    )
    .max(30),
  certifications: lines,
  educationOrder: z
    .array(id)
    .max(20)
    .refine(
      (order) => new Set(order).size === order.length,
      "Use each education entry once.",
    )
    .optional(),
});
export type CvContent = z.infer<typeof cvContentSchema>;
// Existing JSON revisions may omit the new metadata fields; AI outputs must be fully required.
export const cvExtractionSchema = cvContentSchema
  .omit({ educationOrder: true })
  .extend({
    languages: lines,
    experience: z
      .array(
        cvContentSchema.shape.experience.element.extend({
          employmentType: short,
          workMode: workModeSchema,
          location: short,
        }),
      )
      .max(30),
  });
export const emptyContent: CvContent = {
  name: "",
  headline: "",
  email: "",
  phone: "",
  location: "",
  links: [],
  summary: "",
  skills: [],
  experience: [],
  education: [],
  projects: [],
  certifications: [],
};
export const statuses = [
  "Saved",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
] as const;
export const statusSchema = z.enum(statuses);
export const requirementSchema = z.object({
  id,
  text: short.trim().min(1),
  group: z.enum(["required", "responsibility", "preferred"]),
});
export const requirementsSchema = z.array(requirementSchema).max(80);
export type Requirement = z.infer<typeof requirementSchema>;
const date = z.union([z.literal(""), z.iso.date()]);
const safeUrl = z.union([
  z.literal(""),
  z.url({ protocol: /^https?$/ }).max(2000),
]);
export const applicationInputSchema = z.object({
  company: short.trim().min(1, "Enter a company"),
  role: short.trim().min(1, "Enter a role"),
  workMode: workModeSchema.optional(),
  location: short.optional(),
  posting: text.min(20, "Paste the full job posting"),
  requirements: requirementsSchema,
  url: safeUrl,
  notes: text,
  status: statusSchema,
  appliedDate: date,
  nextActionDate: date,
  submittedRevisionId: id.nullable(),
});
export type ApplicationInput = z.infer<typeof applicationInputSchema>;
export const applicationSchema = applicationInputSchema.extend({
  workMode: workModeSchema,
  location: short,
  id,
  revision: z.number().int(),
  postingRevision: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  history: z.array(
    z.object({ id, status: statusSchema, createdAt: z.string() }),
  ),
});
export type Application = z.infer<typeof applicationSchema>;
export const profileSchema = z.object({
  revision: z.number().int(),
  content: cvContentSchema,
  updatedAt: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;
export const evidenceInputSchema = z.object({
  title: short.trim().min(1, "Enter a title"),
  kind: z.enum([
    "Project",
    "Achievement",
    "Responsibility",
    "Certification",
    "Note",
  ]),
  text: text.trim().min(1, "Add the evidence"),
  tags: lines,
  confirmed: z.boolean(),
  sourceId: id.nullable(),
  careerEntryId: z.string().max(120).nullable().optional(),
});
export type EvidenceInput = z.infer<typeof evidenceInputSchema>;
export const evidenceSchema = evidenceInputSchema.extend({
  id,
  revision: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Evidence = z.infer<typeof evidenceSchema>;
export const openQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  status: z.string(),
  evidenceId: z.string().nullable(),
  createdAt: z.string(),
});
export type OpenQuestion = z.infer<typeof openQuestionSchema>;
export const sourceSchema = z.object({
  id,
  name: short,
  text,
  createdAt: z.string(),
});
export type Source = z.infer<typeof sourceSchema>;
export const sourceSummarySchema = sourceSchema.omit({ text: true });
export const revisionSchema = z.object({
  id,
  number: z.number().int(),
  content: cvContentSchema,
  reason: short,
  createdAt: z.string(),
});
export const sourceRefSchema = z.object({ id, title: short, text });
export const suggestionSchema = z.object({
  id,
  baseRevision: z.number().int(),
  postingRevision: z.number().int(),
  target: short,
  original: z.string().max(50000),
  proposed: z.string().max(50000),
  rationale: text,
  sources: z.array(sourceRefSchema),
  status: z.enum(["pending", "accepted", "rejected", "undone", "generated"]),
  createdAt: z.string(),
});
export type Suggestion = z.infer<typeof suggestionSchema>;
export const RUBRIC = "cvraga-match-v2-grounded-skills";
export const matchItemSchema = z.object({
  requirementId: id,
  status: z.enum(["supported", "partial", "absent"]),
  cvQuote: text,
  reason: text,
});
export const matchResultSchema = z.object({
  items: z.array(matchItemSchema),
  requirements: requirementsSchema,
  model: short,
});
export type MatchItem = z.infer<typeof matchItemSchema>;
export const assessmentSchema = z.object({
  id,
  cvRevision: z.number().int(),
  applicationId: id,
  postingRevision: z.number().int(),
  rubric: short,
  score: z.number().int(),
  result: matchResultSchema,
  stale: z.boolean(),
  createdAt: z.string(),
});
export const cvSchema = z.object({
  id,
  title: short,
  template: short,
  applicationId: id.nullable(),
  currentRevision: z.number().int(),
  profileRevision: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  revisions: z.array(revisionSchema),
  suggestions: z.array(suggestionSchema),
  assessments: z.array(assessmentSchema),
  coverLetters: z.array(coverLetterSchema),
  reviewRuns: z.array(reviewRunSchema),
  exportChecks: z.array(exportCheckSchema),
  messages: z
    .array(
      z.object({
        id,
        role: z.enum(["user", "assistant"]),
        text: z.string().max(10000),
        cvRevision: z.number().int(),
        createdAt: z.string(),
      }),
    )
    .default([]),
});
export type Cv = z.infer<typeof cvSchema>;
export const settingsSchema = z.object({
  aiConfigured: z.boolean(),
  model: short,
  database: z.literal("connected"),
});
