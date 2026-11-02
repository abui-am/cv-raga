import "server-only";
import { z } from "zod";
import type { CvContent } from "@/lib/contracts";
import { contentText, normalize } from "@/lib/domain";
import {
  GENERAL_SKILLS,
  REFINEMENT_POLICY,
  unmetRequirements,
  type Checklist,
} from "@/lib/refinement-policy";
import { askAi } from "./ai";
import type { TailoringSource } from "./tailoring";
import { selectEvidence } from "@/lib/evidence-selection";

export async function planRefinement(
  content: CvContent,
  checklist: Checklist,
  sources: TailoringSource[],
) {
  const missing = unmetRequirements(checklist);
  if (!missing.length) return [];
  const aliases = Object.fromEntries(
    selectEvidence(sources, missing).map((source, index) => [
      `s${index + 1}`,
      source,
    ]),
  );
  const result = await askAi(
    z.object({
      checks: z
        .array(
          z.object({
            requirementId: z.enum(missing.map((requirement) => requirement.id)),
            basis: z.enum(["direct", "inferred_general", "needs_answer"]),
            generalSkill: z.enum(["", ...GENERAL_SKILLS]),
            reason: z.string().min(1).max(1500),
            evidence: z
              .array(
                z.object({
                  sourceId: z.enum(["", ...Object.keys(aliases)]),
                  quote: z.string().max(4000),
                }),
              )
              .max(4),
            question: z.string().max(1500),
          }),
        )
        .max(80),
    }),
    "refinement_evidence_plan",
    `${REFINEMENT_POLICY}
Create an evidence plan for EVERY unmet requirement before editing. For direct or inferred_general, cite at least one exact contiguous quote of eight or more characters from confirmed sources. Choose inferred_general only for a generalSkill from the allowed list, and explain how the behavior demonstrates it; do not use it for an unmentioned specific qualification. Use needs_answer only after searching the supplied career record; its question must seek the specific missing fact, not reconfirm documented work. For supported checks, question is empty. The plan is guidance for writing, never a score or a new saved fact.`,
    {
      unmetRequirements: missing,
      cvText: contentText(content),
      sources: Object.entries(aliases).map(([id, source]) => ({
        id,
        title: source.title,
        text: source.text,
      })),
    },
  );
  return missing.map((requirement) => {
    const proposed = result.checks.find(
      (check) => check.requirementId === requirement.id,
    );
    const verified =
      proposed?.evidence.filter(
        (proof) =>
          aliases[proof.sourceId] &&
          normalize(proof.quote).length >= 8 &&
          normalize(aliases[proof.sourceId].text).includes(
            normalize(proof.quote),
          ),
      ) || [];
    const grounded =
      proposed &&
      proposed.basis !== "needs_answer" &&
      verified.length > 0 &&
      verified.length === proposed.evidence.length &&
      (proposed.basis !== "inferred_general" || proposed.generalSkill !== "");
    return {
      requirementId: requirement.id,
      requirement: requirement.text,
      group: requirement.group,
      basis: grounded ? proposed.basis : ("needs_answer" as const),
      generalSkill: grounded ? proposed.generalSkill : "",
      reason: grounded
        ? proposed.reason
        : "No verified source currently establishes this requirement.",
      evidence: grounded
        ? verified.map((proof) => ({
            sourceId: aliases[proof.sourceId].id,
            quote: proof.quote,
          }))
        : [],
      question: grounded
        ? ""
        : proposed?.basis === "needs_answer" && proposed.question.trim()
          ? proposed.question.trim()
          : `For “${requirement.text}”, what have you personally done, in which role or project, and what was the outcome? A qualitative example is enough.`,
    };
  });
}
