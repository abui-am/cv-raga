import type { PersonaResult } from "./review-contracts";
import { normalize } from "./domain";

export const reviewerDefinitions = {
  HR: {
    label: "HR",
    focus: "Job requirements, clarity and application consistency",
    criteria: [
      {
        id: "hr_requirements",
        label: "Required qualifications",
        question:
          "Which explicit required criteria are supported, partial or missing? Keep preferred criteria separate.",
      },
      {
        id: "hr_clarity",
        label: "Clarity & chronology",
        question:
          "Is the relevant experience clear, concise and chronologically understandable? Do not infer reliability from career gaps.",
      },
      {
        id: "hr_letter",
        label: "Cover letter relevance",
        question:
          "Does the confirmed letter address this role with specific examples rather than repeat the entire CV? If there is no letter, mark not_assessed.",
      },
    ],
  },
  TeamLead: {
    label: "Team Lead",
    focus: "Technical evidence, quality and individual contribution",
    criteria: [
      {
        id: "tl_technical",
        label: "Technical relevance",
        question:
          "What applied technical skills and transferable engineering fundamentals are evidenced against this posting? Do not impose extra stack preferences.",
      },
      {
        id: "tl_quality",
        label: "Engineering quality",
        question:
          "Where are testing, debugging, security, maintainability or operational support evidenced, as relevant to this job?",
      },
      {
        id: "tl_ownership",
        label: "Contribution & decisions",
        question:
          "Is the candidate's own contribution and decision-making clear, distinct from team or product-wide achievements?",
      },
    ],
  },
  Management: {
    label: "Management",
    focus: "Business outcomes, collaboration and role-level ownership",
    criteria: [
      {
        id: "mg_impact",
        label: "Business & customer outcomes",
        question:
          "Which outcomes support the employer's stated needs? Only use verified numbers; suggest qualitative outcomes where metrics are unavailable.",
      },
      {
        id: "mg_collaboration",
        label: "Collaboration & initiative",
        question:
          "What evidence shows collaboration, communication and initiative at the level required? Do not require people management for individual-contributor jobs.",
      },
      {
        id: "mg_alignment",
        label: "Priorities & ownership",
        question:
          "Does the application show ownership and prioritization relevant to business, customers and operations in this posting?",
      },
    ],
  },
} as const;
export function validatePersonaResult(
  persona: keyof typeof reviewerDefinitions,
  result: PersonaResult,
  documents: { cv: string; cover_letter: string },
) {
  const expected = new Set<string>(
    reviewerDefinitions[persona].criteria.map((c) => c.id),
  );
  if (
    new Set(result.criteria.map((c) => c.id)).size !== 3 ||
    !result.criteria.every((c) => expected.has(c.id))
  )
    throw new Error("Review criteria did not match this perspective");
  for (const criterion of result.criteria) {
    if (
      criterion.id === "hr_letter" &&
      !documents.cover_letter &&
      criterion.status !== "not_assessed"
    )
      throw new Error("A missing letter cannot be assessed");
    if (
      criterion.quote &&
      (criterion.document === "none" ||
        !normalize(documents[criterion.document]).includes(
          normalize(criterion.quote),
        ))
    )
      throw new Error("Unverifiable review quote");
    if (
      ["evident", "partial"].includes(criterion.status) &&
      (criterion.quote.trim().length < 8 || criterion.document === "none")
    )
      throw new Error("Supporting evidence requires a source quote");
  }
  return result;
}
