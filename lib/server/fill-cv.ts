import "server-only";
import { z } from "zod";
import type { Application, CvContent } from "@/lib/contracts";
import { contentText, replaceTarget, tailoringTargets } from "@/lib/domain";
import { CV_MIN_PAGE_FILL, CV_PAGE_LIMIT } from "@/lib/export-contracts";
import { askAi } from "./ai";
import { measureCvLayout } from "./export-quality";
import { HttpError } from "./http";
import type { TailoringSource } from "./tailoring";
import { validateDocument } from "./validation";
import { isPublication } from "@/lib/publications";
import { REFINEMENT_POLICY } from "@/lib/refinement-policy";

const normalized = (text: string) =>
  text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Fill remaining space with separately cited facts; never stretch the template or add blank pages. */
export async function fillTwoPages(
  content: CvContent,
  application: Application,
  sources: TailoringSource[],
  feedback: unknown = null,
) {
  let candidate = structuredClone(content);
  let layout = await measureCvLayout(candidate);
  type Change = {
    target: string;
    original: string;
    proposed: string;
    rationale: string;
    sourceIds: string[];
  };
  const changes = new Map<string, Change>();
  if (layout.full) return { content: candidate, changes: [] as Change[] };
  const targets = tailoringTargets(candidate);
  const allowed = Object.keys(targets).filter(
    (target) =>
      ["summary", "skills", "certifications"].includes(target) ||
      target.endsWith(":bullets"),
  );
  const aliases = Object.fromEntries(
    sources.map((source, i) => [`s${i + 1}`, source]),
  );
  const result = await askAi(
    z.object({
      expansions: z
        .array(
          z.object({
            target: z.enum(allowed),
            text: z.string().trim().min(1).max(1800),
            rank: z.number().int().min(1).max(100),
            rationale: z.string().max(1000),
            evidence: z
              .array(
                z.object({
                  sourceId: z.enum(Object.keys(aliases)),
                  quote: z.string().min(8).max(3000),
                }),
              )
              .min(1)
              .max(8),
          }),
        )
        .max(48),
    }),
    "two_full_pages",
    `${REFINEMENT_POLICY}\n# Required result
Fill the CV to EXACTLY TWO FULL US Letter pages, using the current fixed 11pt template. The renderer measured the supplied pageFill ratios inside its normal print margins. Each page must reach minimumPageFill. A one-page CV or a mostly empty second page does not meet the request.
# Useful content first
Return a generous pool of distinct, evidence-backed expansions that the application can fit individually. First cover required qualifications and responsibilities, then add relevant NICE-TO-HAVE achievements, preferred skills, testing, documentation, collaboration, ownership and project details that are actually supported. Nice-to-have means an additional verified fact, never a desired but unproven qualification. Keep direct job evidence first. Use rank 1 for most useful and 100 for least useful. Aim for 15–35 words per achievement. Do not repeat an existing claim in different words or pad with generic duties.
# Professional summary fallback
Always offer up to three progressively fuller professional summaries when the existing summary is missing or could use supported detail: roughly 60, 100 and at most 160 words. Ground each in the candidate's verified experience, strengths, scope and outcomes. These are alternative complete replacements for target summary, not appendices. Use this space when concise role evidence alone cannot fill two pages. Do not invent motivation, personality, tenure or expertise.
# Output and provenance
For summary, text is a complete replacement. For every other allowed target, text is ONE additional bullet, skill or certification; never an entire list and never a new heading. Cite exact verbatim quotes of at least eight characters from the supplied short source aliases for every expansion. Keep achievements at the correct employer/project; never transfer a fact between roles or infer authorship from code. Do not add roles, dates, metrics, qualifications or skills absent from confirmed sources. User/reviewer feedback is advice, not evidence. Return no unsupported content if the career record is insufficient. The application selects additions by relevance, verifies quotes, and measures the PDF after each addition; overflowing additions are skipped. Do not change margins, fonts, spacing, insert page breaks or add hidden text.`,
    {
      job: { role: application.role, company: application.company },
      posting: application.posting,
      requirements: application.requirements,
      refinementFeedback: feedback,
      currentDraft: contentText(candidate),
      targets,
      sources: Object.entries(aliases).map(([id, source]) => ({
        id,
        title: source.title,
        text: source.text,
      })),
      constraints: {
        requiredPages: CV_PAGE_LIMIT,
        minimumPageFill: CV_MIN_PAGE_FILL,
        measuredLayout: layout,
        maximumSummaryWords: 160,
        fontSizePt: 11,
        suggestedAdditionalWords: Math.max(
          50,
          Math.min(
            1400,
            Math.ceil(
              words(contentText(candidate)) *
                (1.94 /
                  Math.max(
                    0.1,
                    layout.pageFill.reduce((a, b) => a + b, 0),
                  ) -
                  1),
            ),
          ),
        ),
      },
    },
  );
  for (const expansion of [...result.expansions].sort(
    (a, b) => a.rank - b.rank || words(a.text) - words(b.text),
  )) {
    if (
      !allowed.includes(expansion.target) ||
      !expansion.evidence.length ||
      expansion.evidence.some(
        (proof) =>
          !aliases[proof.sourceId] ||
          normalized(proof.quote).length < 8 ||
          !normalized(aliases[proof.sourceId].text).includes(
            normalized(proof.quote),
          ),
      )
    )
      continue;
    const before = tailoringTargets(candidate)[expansion.target];
    if (expansion.target === "summary") {
      if (words(expansion.text) <= words(before) || words(expansion.text) > 160)
        continue;
    } else {
      if (
        expansion.target === "certifications" &&
        isPublication(expansion.text)
      )
        continue;
      // List additions are atomic. Similar wording is not a second achievement.
      if (expansion.text.includes("\n") || words(expansion.text) > 45) continue;
      const tokens = new Set(
        normalized(expansion.text)
          .split(/\W+/)
          .filter((token) => token.length > 3),
      );
      const repeated = before.split("\n").some((line) => {
        const existing = normalized(line);
        const overlap = [...tokens].filter((token) =>
          existing.split(/\W+/).includes(token),
        ).length;
        return (
          existing === normalized(expansion.text) ||
          (tokens.size > 3 && overlap / tokens.size >= 0.7)
        );
      });
      if (repeated) continue;
    }
    const proposed =
      expansion.target === "summary"
        ? expansion.text
        : [before, expansion.text].filter(Boolean).join("\n");
    const next = replaceTarget(candidate, expansion.target, proposed);
    if (contentText(next).length > 20000) continue;
    const measured = await measureCvLayout(next);
    if (
      measured.pages > CV_PAGE_LIMIT ||
      measured.pageFill.reduce((a, b) => a + b, 0) <=
        layout.pageFill.reduce((a, b) => a + b, 0)
    )
      continue;
    const previous = changes.get(expansion.target);
    changes.set(expansion.target, {
      target: expansion.target,
      original: previous?.original ?? before,
      proposed,
      rationale: expansion.rationale,
      sourceIds: [
        ...new Set([
          ...(previous?.sourceIds || []),
          ...expansion.evidence.map((proof) => aliases[proof.sourceId].id),
        ]),
      ],
    });
    candidate = next;
    layout = measured;
    if (layout.full) break;
  }
  if (!layout.full)
    throw new HttpError(
      422,
      "AI could not fill two complete pages with distinct, verified facts. Add more detail about your responsibilities, outcomes, projects or relevant nice-to-have skills in My career, or discuss them with the AI assistant, then try again. Your saved CV is unchanged.",
    );
  validateDocument(candidate);
  return { content: candidate, changes: [...changes.values()] };
}
