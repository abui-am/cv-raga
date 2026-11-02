import "server-only";
import { z } from "zod";
import type { Application, CvContent } from "@/lib/contracts";
import {
  contentText,
  editableTargets,
  isSelectionTarget,
  replaceTarget,
  tailoringTargets,
} from "@/lib/domain";
import { CV_PAGE_LIMIT } from "@/lib/export-contracts";
import { askAi } from "./ai";
import { HttpError } from "./http";
import { measureCv } from "./export-quality";
import {
  fitByPriority,
  prioritySchema,
  priorityTargets,
} from "./prioritize-cv";
import { validateDocument } from "./validation";
import { fillTwoPages } from "./fill-cv";
import { preservePublications, publicationEntries } from "@/lib/publications";
import { REFINEMENT_POLICY } from "@/lib/refinement-policy";
import { selectEvidence } from "@/lib/evidence-selection";

export type TailoringSource = {
  id: string;
  title: string;
  text: string;
  publications?: string[];
};
const changeSchema = z.object({
  target: z.string(),
  original: z.string(),
  proposed: z.string(),
  rationale: z.string(),
  sourceIds: z.array(z.string()),
});
type Change = z.infer<typeof changeSchema>;
const wordCount = (content: CvContent) =>
  contentText(content).trim().split(/\s+/).filter(Boolean).length;

/** Collapse iterative edits and omissions into one non-overlapping proposal against the saved original. */
function finalChanges(
  original: CvContent,
  proposed: CvContent,
  history: Map<string, Change>,
  reasons: Map<string, string>,
  sourceId: string,
): Change[] {
  const before = editableTargets(original);
  const after = editableTargets(proposed);
  const selections = (["experience", "projects", "education"] as const).filter(
    (section) =>
      JSON.stringify(original[section].map((e) => e.id)) !==
      JSON.stringify(proposed[section].map((e) => e.id)),
  );
  const targets = [
    ...Object.keys(tailoringTargets(original)).filter(
      (target) =>
        !selections.some((section) => target.startsWith(`${section}:`)),
    ),
    ...selections,
  ];
  return targets
    .filter((target) => before[target] !== after[target])
    .map((target) => {
      const previous = history.get(target);
      const related = isSelectionTarget(target)
        ? [...history.values()].filter(
            (c) => c.target === target || c.target.startsWith(`${target}:`),
          )
        : previous
          ? [previous]
          : [];
      return {
        target,
        original: before[target],
        proposed: after[target],
        rationale:
          reasons.get(target) ||
          previous?.rationale ||
          `Selected the most relevant ${target} for the job while fitting the CV within two pages. Omitted details remain in the original CV.`,
        sourceIds: [
          ...new Set([sourceId, ...related.flatMap((c) => c.sourceIds)]),
        ],
      };
    });
}

export function combineTailoring(
  original: CvContent,
  proposed: CvContent,
  changes: Change[],
  sourceId: string,
) {
  const history = new Map<string, Change>();
  for (const change of changes) {
    const previous = history.get(change.target);
    history.set(change.target, {
      ...change,
      sourceIds: [
        ...new Set([...(previous?.sourceIds || []), ...change.sourceIds]),
      ],
    });
  }
  return {
    content: proposed,
    changes: finalChanges(original, proposed, history, new Map(), sourceId),
  };
}

export async function generateTailoring(
  content: CvContent,
  application: Application,
  sources: TailoringSource[],
  feedback: unknown = null,
) {
  const request =
    feedback &&
    typeof feedback === "object" &&
    "userRequest" in feedback &&
    typeof feedback.userRequest === "string"
      ? feedback.userRequest
      : "";
  sources = selectEvidence(
    sources,
    application.requirements,
    `${application.posting} ${request}`,
  );
  if (
    !sources.length ||
    sources.length > 800 ||
    JSON.stringify(sources).length > 120000
  )
    throw new HttpError(
      422,
      "Your evidence library is empty or too large for this run. Confirm relevant source evidence before tailoring.",
    );
  const publicationSources = sources.filter(
    (source) => source.publications?.length,
  );
  const requiredPublications = publicationSources.length
    ? [...new Set(publicationSources.flatMap((source) => source.publications!))]
    : publicationEntries(content);
  let candidate = preservePublications(content, requiredPublications);
  let previousPages: number | null = null;
  let priorities: z.infer<typeof prioritySchema>[] = [];
  const history = new Map<string, Change>();
  if (requiredPublications.length)
    history.set("certifications", {
      target: "certifications",
      original: content.certifications.join("\n"),
      proposed: candidate.certifications.join("\n"),
      rationale: "Keep your publication and complete article link.",
      sourceIds: publicationSources.length
        ? publicationSources.map((source) => source.id)
        : [sources[0].id],
    });
  const aliases: Record<string, TailoringSource> = Object.fromEntries(
    sources.map((source, index) => [`s${index + 1}`, source]),
  );
  // Two tailoring/shortening calls at most, then one expansion pool if pages still need content.
  for (let attempt = 0; attempt < 2; attempt++) {
    const targets = tailoringTargets(candidate);
    const units = priorityTargets(candidate);
    const resultSchema = z.object({
      changes: z
        .array(
          changeSchema.omit({ original: true }).extend({
            target: z.enum(Object.keys(targets)),
            sourceIds: z.array(z.enum(Object.keys(aliases))).min(1),
          }),
        )
        .max(40),
      priorities: z.object(
        Object.fromEntries(
          units.map((unit) => [
            unit.target,
            prioritySchema.omit({ target: true }),
          ]),
        ),
      ),
    });
    const maximumWords =
      attempt === 0
        ? 1100
        : Math.max(
            180,
            Math.min(
              950,
              Math.floor(
                ((wordCount(candidate) * CV_PAGE_LIMIT) / previousPages!) * 0.9,
              ),
            ),
          );
    const result = await askAi(
      resultSchema,
      "tailoring_changes",
      `${REFINEMENT_POLICY}\n# Task\nTailor this CV to the supplied job and fill EXACTLY TWO FULL US Letter pages at the existing 11pt font. Avoid a one-page result or a sparse second page. Two pages is also the hard maximum; prioritize relevant facts instead of overflowing. When refinementFeedback is provided, address those user instructions or reviewer observations using only the confirmed sources. Reviewer feedback is advice, never new factual evidence. Keep unsupported qualifications as gaps and never invent information to satisfy a reviewer. Cover-letter feedback must not be turned into invented CV claims.\n# Protected publications\nEvery protectedPublications entry is mandatory, including its complete URL. Do not remove, shorten, paraphrase or strip links from publications. Cut optional role/project bullets before removing a publication.\n# Prioritization\nFill every required priorities object property with rank 1 (most essential) to 100 (least relevant) and a brief job-specific reason. Prioritize evidence of required qualifications, direct responsibilities, recent relevant achievements, and individual impact. Prefer strong relevant evidence over generic keyword lists. Rank unrelated projects, repeated achievements, old unrelated roles and optional awards lowest. Within each skills list and role's bullet list, place the strongest job-relevant evidence first. The application will use these ranks to omit lower-priority content if the rendered PDF is still too long.\n# Hard content budget\nUse no more than constraints.maximumWords TOTAL words, including headings and fixed details. Include a professional summary of roughly 60-100 words using verified strengths, scope and achievements; expand it up to 160 words if needed to fill two pages. Skills: a focused set, strongest required skills first. Recent relevant roles: usually 3-5 distinct bullets of 15-35 words each. Older relevant roles: 1-3 concise bullets. Include relevant nice-to-have achievements, preferred skills, testing, documentation and collaboration only when confirmed by the sources. Remove repetition and unrelated material, while retaining useful evidence to fill both pages. Never pad with invented or generic claims.\n# Correction\nOn a correction pass, targets and currentDraft are the FAILED SHORTENED DRAFT, not the original long CV. Use the measured previousProposalPages and tighter maximumWords to substantially cut it further.\n# Truth and output\nNever invent skills, metrics, employers, roles, dates, education or achievements. Do not rewrite fixed contact or entry headings, and never transfer an achievement between different employers or roles. Return up to 40 changes using the allowed target keys and short source aliases from the supplied sources. Return proposed wording and a concise rationale only; do not echo original text because the application constructs the original/proposed comparison. Use one edit per target. List targets use newline-separated text; an empty string omits that list. Do not change the template, shrink fonts, clip content or pretend a three-page result is two pages.`,
      {
        posting: application.posting,
        requirements: application.requirements,
        job: {
          role: application.role,
          company: application.company,
          workMode: application.workMode,
          location:
            application.workMode === "Remote" ? "" : application.location,
        },
        refinementFeedback: feedback,
        protectedPublications: requiredPublications,
        targets,
        priorityTargets: units,
        currentDraft: contentText(candidate),
        sources: Object.entries(aliases).map(([alias, source]) => ({
          id: alias,
          title: source.title,
          text: source.text,
        })),
        constraints: {
          maximumPages: CV_PAGE_LIMIT,
          pageSize: "US Letter",
          fontSizePt: 11,
          maximumWords,
          currentWords: wordCount(candidate),
          previousProposalPages: previousPages,
        },
      },
    );
    const edits = new Map<string, (typeof result.changes)[number]>();
    for (const change of result.changes) {
      if (
        !Object.hasOwn(targets, change.target) ||
        change.proposed.length > 20000 ||
        !change.sourceIds.length ||
        !change.sourceIds.every((id) => Object.hasOwn(aliases, id))
      )
        throw new HttpError(
          422,
          "AI returned a change that could not be verified against the source CV. No CV changes were saved. Try again.",
        );
      const previous = edits.get(change.target);
      edits.set(change.target, {
        ...change,
        sourceIds: [
          ...new Set([...(previous?.sourceIds || []), ...change.sourceIds]),
        ],
      });
    }
    for (const generated of edits.values()) {
      if (generated.proposed === targets[generated.target]) continue;
      const change: Change = {
        ...generated,
        original: targets[generated.target],
        sourceIds: generated.sourceIds.map((alias) => aliases[alias].id),
      };
      candidate = replaceTarget(candidate, change.target, change.proposed);
      const previous = history.get(change.target);
      history.set(change.target, {
        ...change,
        sourceIds: [
          ...new Set([...(previous?.sourceIds || []), ...change.sourceIds]),
        ],
      });
    }
    const ranked = new Set<string>();
    const rankedPriorities = Object.entries(result.priorities).map(
      ([target, value]) => ({ target, ...value }),
    );
    for (const priority of rankedPriorities) {
      if (
        ranked.has(priority.target) ||
        !units.some((u) => u.target === priority.target)
      )
        throw new HttpError(
          422,
          "AI could not verify its content priorities. Your saved CV is unchanged; try again.",
        );
      ranked.add(priority.target);
    }
    if (ranked.size !== units.length)
      throw new HttpError(
        422,
        "AI did not prioritize every CV section. Your saved CV is unchanged; try again.",
      );
    priorities = rankedPriorities;
    candidate = preservePublications(candidate, requiredPublications);
    validateDocument(candidate);
    previousPages = await measureCv(candidate);
    if (previousPages <= CV_PAGE_LIMIT) break;
  }
  const fitted =
    previousPages! > CV_PAGE_LIMIT
      ? await fitByPriority(candidate, priorities)
      : { content: candidate, reasons: new Map<string, string>() };
  validateDocument(fitted.content);
  const filled = await fillTwoPages(
    fitted.content,
    application,
    sources,
    feedback,
  );
  for (const change of filled.changes) {
    fitted.reasons.delete(change.target);
    const previous = history.get(change.target);
    history.set(change.target, {
      ...change,
      sourceIds: [
        ...new Set([...(previous?.sourceIds || []), ...change.sourceIds]),
      ],
    });
  }
  return {
    content: filled.content,
    changes: finalChanges(
      content,
      filled.content,
      history,
      fitted.reasons,
      sources[0].id,
    ),
  };
}
