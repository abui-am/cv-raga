import "server-only";
import { database } from "./db";
import { getApplication, getCv } from "./records";
import { assessCv, evaluateMatch } from "./match";
import { combineTailoring, generateTailoring } from "./tailoring";
import { refinementSources, refineCv } from "./refine-cv";
import { measureCvLayout } from "./export-quality";
import { HttpError, requireValue } from "./http";
import {
  improvesChecks,
  preservesChecks,
  unmetRequirements,
} from "@/lib/refinement-policy";
import { planRefinement } from "./refinement-plan";

export async function optimizeMatch(
  id: string,
  options: { replyMessageId?: string; userInstruction?: string } = {},
) {
  let cv = await getCv(id);
  const app = await getApplication(
    requireValue(
      cv.applicationId,
      "Choose a job posting before improving the match.",
    ),
  );
  if (!app.requirements.length)
    throw new HttpError(
      400,
      "Add and review the job requirements before improving the match.",
    );
  let baseline = cv.assessments.find((a) => !a.stale);
  if (!baseline) {
    await assessCv(cv, app);
    cv = await getCv(id);
    baseline = cv.assessments.find((a) => !a.stale);
  }
  if (!baseline)
    throw new HttpError(
      409,
      "The CV or posting changed while scoring. Reload before optimizing.",
    );
  const context = await refinementSources(cv);
  const original = cv.revisions[0].content;
  const evidencePlan = await planRefinement(
    original,
    baseline.result,
    context.sources,
  );
  const originalLayout = await measureCvLayout(original);
  let bestContent = original;
  let best = { score: baseline.score, result: baseline.result };
  let selected: ReturnType<typeof combineTailoring> | null = null;
  const acceptedChanges: Awaited<
    ReturnType<typeof generateTailoring>
  >["changes"] = [];
  let previousAttempt: unknown = null;
  let attempts = 0;
  for (
    ;
    attempts < 2 &&
    (unmetRequirements(best.result).length > 0 ||
      (!selected && !originalLayout.full));
    attempts++
  ) {
    const proposal = await generateTailoring(
      bestContent,
      app,
      context.sources,
      {
        objective:
          "Fill the unmet job checklist using the complete confirmed career record and the verified evidence plan. Required checks first, then responsibilities, then preferred checks. Make reasonable general-skill deductions from documented behavior and explain their source. Preserve already supported checks and keep two full pages, publication links and stated language levels. Specific qualifications without evidence stay as questions, not invented claims.",
        currentMatch: best,
        evidencePlan,
        userRequest: options.userInstruction || null,
        previousAttempt,
      },
    );
    if (!proposal.changes.length) break;
    const candidate = await evaluateMatch(
      proposal.content,
      app,
      context.sources,
    );
    const noRegression = preservesChecks(best.result, candidate.result);
    previousAttempt = {
      score: candidate.score,
      items: candidate.result.items,
      rejectedForLosingChecks: !noRegression,
    };
    if (
      noRegression &&
      (candidate.score > best.score ||
        (candidate.score === best.score &&
          (improvesChecks(best.result, candidate.result) ||
            (!selected && !originalLayout.full))))
    ) {
      bestContent = proposal.content;
      best = candidate;
      acceptedChanges.push(...proposal.changes);
      selected = combineTailoring(
        original,
        bestContent,
        acceptedChanges,
        context.sources[0].id,
      );
    }
  }
  const missing = unmetRequirements(best.result);
  const questions = evidencePlan
    .filter(
      (check) =>
        check.basis === "needs_answer" &&
        missing.some((requirement) => requirement.id === check.requirementId),
    )
    .slice(0, 2);
  const supported = best.result.requirements.length - missing.length;
  const summary = `Match improvement: ${baseline.score}/100 → ${best.score}/100. ${selected ? "Saved the best supported CV revision and verified its two-page PDF." : !missing.length ? "Your current CV already supports every reviewed check; no wording changes were needed." : "No supported candidate improved the current checklist or score, so your CV was left unchanged."} ${supported}/${best.result.requirements.length} checks supported.\n\n${
    missing.length
      ? `Evidence still needed:\n${missing
          .slice(0, 5)
          .map((requirement) => `• ${requirement.text}`)
          .join(
            "\n",
          )}${questions.length ? `\n\nHelp me fill the remaining checks:\n${questions.map((check, index) => `${index + 1}. ${check.question}`).join("\n\n")}\n\nReply in the AI assistant. Your factual answers can update My career and support the next improvement.` : "\n\nI found related evidence in your career record, but these checks are not yet fully expressed in the saved CV. I will use that evidence in the next refinement; you do not need to repeat it."}`
      : "All listed requirements have supporting CV evidence."
  }\n\nThis is CVRaga Match, not an employer ATS score or hiring guarantee.`;
  if (selected)
    await refineCv(
      cv,
      app,
      null,
      `AI improved CVRaga Match from ${baseline.score} to ${best.score}`,
      {
        prepared: { context, proposal: selected },
        assessment: best,
        message: options.replyMessageId
          ? undefined
          : "Improve my CVRaga Match using confirmed evidence.",
        reply: summary,
        updateMessage: options.replyMessageId
          ? { id: options.replyMessageId, text: summary }
          : undefined,
      },
    );
  else
    await database().$transaction(async (tx) => {
      const live = requireValue(await tx.cv.findUnique({ where: { id } }));
      const posting = requireValue(
        await tx.application.findUnique({ where: { id: app.id } }),
      );
      if (
        live.currentRevision !== cv.currentRevision ||
        posting.postingRevision !== app.postingRevision
      )
        throw new HttpError(
          409,
          "The CV or posting changed during optimization. Reload first.",
        );
      if (options.replyMessageId)
        await tx.cvMessage.update({
          where: { id: options.replyMessageId },
          data: { text: summary, cvRevision: cv.currentRevision },
        });
      else
        await tx.cvMessage.createMany({
          data: [
            {
              cvId: id,
              role: "user",
              text: "Improve my CVRaga Match using confirmed evidence.",
              cvRevision: cv.currentRevision,
            },
            {
              cvId: id,
              role: "assistant",
              text: summary,
              cvRevision: cv.currentRevision,
            },
          ],
        });
    });
  return getCv(id);
}
