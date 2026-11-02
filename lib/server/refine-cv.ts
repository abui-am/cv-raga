import "server-only";
import type { Application, Cv } from "@/lib/contracts";
import { contentText } from "@/lib/domain";
import { EXPORT_CHECK_VERSION } from "@/lib/export-contracts";
import { database } from "./db";
import { getProfile } from "./records";
import { careerEvidenceTitle } from "@/lib/career";
import { generateTailoring } from "./tailoring";
import { checkCvExports } from "./export-quality";
import { HttpError, requireValue } from "./http";
import { RUBRIC } from "@/lib/contracts";
import type { evaluateMatch } from "./match";
import { publicationEntries } from "@/lib/publications";

export async function refinementSources(cv: Cv) {
  const db = database();
  const profile = await getProfile();
  const evidence = await db.evidence.findMany({
    where: { confirmed: true, consolidatedAt: null },
    orderBy: { id: "asc" },
  });
  return {
    profile,
    evidence,
    sources: [
      {
        id: `cv-${cv.id}-${cv.currentRevision}`,
        title: `CV revision ${cv.currentRevision}`,
        text: contentText(cv.revisions[0].content),
      },
      ...(profile
        ? [
            {
              id: `profile-${profile.revision}`,
              title: "Confirmed career details",
              text: contentText(profile.content),
              publications: publicationEntries(profile.content),
            },
          ]
        : []),
      ...evidence.map((e) => ({
        id: `${e.id}-${e.revision}`,
        title: careerEvidenceTitle(profile?.content, e),
        text: e.text,
      })),
    ],
  };
}

export async function refineCv(
  cv: Cv,
  app: Application,
  feedback: unknown,
  reason: string,
  options: {
    reviewId?: string;
    message?: string;
    reply?: string;
    updateMessage?: { id: string; text: string };
    prepared?: {
      context: Awaited<ReturnType<typeof refinementSources>>;
      proposal: Awaited<ReturnType<typeof generateTailoring>>;
    };
    assessment?: Awaited<ReturnType<typeof evaluateMatch>>;
  } = {},
) {
  const db = database();
  const { profile, evidence, sources } =
    options.prepared?.context || (await refinementSources(cv));
  const proposal =
    options.prepared?.proposal ||
    (await generateTailoring(cv.revisions[0].content, app, sources, feedback));
  const { result } = await checkCvExports(proposal.content);
  if (!result.passed)
    throw new HttpError(
      422,
      "The refined CV did not pass export checks. Your current CV is unchanged.",
    );
  const nextRevision = cv.currentRevision + (proposal.changes.length ? 1 : 0);
  await db.$transaction(async (tx) => {
    const live = requireValue(await tx.cv.findUnique({ where: { id: cv.id } }));
    const posting = requireValue(
      await tx.application.findUnique({ where: { id: app.id } }),
    );
    const liveProfile = await tx.profile.findUnique({ where: { id: "main" } });
    const liveEvidence = await tx.evidence.findMany({
      where: { confirmed: true, consolidatedAt: null },
      orderBy: { id: "asc" },
    });
    if (
      live.currentRevision !== cv.currentRevision ||
      posting.postingRevision !== app.postingRevision ||
      liveProfile?.revision !== profile?.revision ||
      JSON.stringify(liveEvidence.map((e) => [e.id, e.revision])) !==
        JSON.stringify(evidence.map((e) => [e.id, e.revision]))
    )
      throw new HttpError(
        409,
        "The CV, posting or supporting evidence changed while AI was refining. Reload before trying again.",
      );
    if (proposal.changes.length) {
      const update = await tx.cv.updateMany({
        where: { id: cv.id, currentRevision: cv.currentRevision },
        data: { currentRevision: { increment: 1 } },
      });
      if (!update.count)
        throw new HttpError(
          409,
          "This CV changed. Reload before applying AI changes.",
        );
      await tx.cvRevision.create({
        data: {
          cvId: cv.id,
          number: nextRevision,
          content: proposal.content,
          reason,
        },
      });
      await tx.suggestion.updateMany({
        where: { cvId: cv.id, status: "pending" },
        data: { status: "rejected" },
      });
      await tx.suggestion.createMany({
        data: proposal.changes.map((c) => ({
          cvId: cv.id,
          baseRevision: cv.currentRevision,
          postingRevision: app.postingRevision,
          target: c.target,
          original: c.original,
          proposed: c.proposed,
          rationale: c.rationale,
          sources: sources.filter((s) => c.sourceIds.includes(s.id)),
          status: "generated",
        })),
      });
    }
    await tx.exportCheck.upsert({
      where: {
        cvId_cvRevision_version: {
          cvId: cv.id,
          cvRevision: nextRevision,
          version: EXPORT_CHECK_VERSION,
        },
      },
      create: {
        cvId: cv.id,
        cvRevision: nextRevision,
        version: EXPORT_CHECK_VERSION,
        result,
      },
      update: { result, createdAt: new Date() },
    });
    if (options.assessment)
      await tx.assessment.create({
        data: {
          cvId: cv.id,
          cvRevision: nextRevision,
          applicationId: app.id,
          postingRevision: app.postingRevision,
          rubric: RUBRIC,
          ...options.assessment,
        },
      });
    if (options.reviewId)
      await tx.reviewRun.update({
        where: { id: options.reviewId },
        data: {
          improvement: {
            status: proposal.changes.length ? "applied" : "unchanged",
            cvRevision: nextRevision,
            error: null,
          },
        },
      });
    if (options.updateMessage)
      await tx.cvMessage.update({
        where: { id: options.updateMessage.id },
        data: { text: options.updateMessage.text, cvRevision: nextRevision },
      });
    if (options.message) {
      const summary = proposal.changes.length
        ? `Applied ${proposal.changes.length} evidence-backed changes as revision ${nextRevision}. Verified PDF: ${result.pdfPages} of 2 pages.\n\n${proposal.changes
            .slice(0, 5)
            .map((c) => `• ${c.rationale}`)
            .join(
              "\n",
            )}\n\nYour previous revision is preserved in Version history.`
        : `Your current CV already meets this request within the supported evidence. Verified PDF: ${result.pdfPages} of 2 pages. Add any new facts to My career and confirm them before asking me to include them.`;
      await tx.cvMessage.createMany({
        data: [
          {
            cvId: cv.id,
            role: "user",
            text: options.message,
            cvRevision: cv.currentRevision,
          },
          {
            cvId: cv.id,
            role: "assistant",
            text: (options.reply || summary).slice(0, 10000),
            cvRevision: nextRevision,
          },
        ],
      });
    }
  });
  return nextRevision;
}
