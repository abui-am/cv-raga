import "server-only";
import { createHash } from "node:crypto";
import { contentText } from "@/lib/domain";
import { EXPORT_CHECK_VERSION } from "@/lib/export-contracts";
import { database } from "./db";
import { checkCvExports } from "./export-quality";
import { HttpError, requireValue } from "./http";
import { getApplication, getCv, getProfile } from "./records";
import { careerEvidenceTitle } from "@/lib/career";
import { generateTailoring } from "./tailoring";
import { publicationEntries } from "@/lib/publications";

export async function createRoleCv(
  applicationId: string,
  baseCvId: string | null,
  postingRevision: number,
) {
  const db = database();
  const application = await getApplication(applicationId);
  if (application.postingRevision !== postingRevision)
    throw new HttpError(
      409,
      "The job posting changed. Reload before tailoring.",
    );
  const profile = requireValue(
    await getProfile(),
    "Confirm your career details before generating a CV. Your opportunity is saved.",
  );
  const base = baseCvId ? await getCv(baseCvId) : null;
  const content = base ? base.revisions[0].content : profile.content;
  const evidence = await db.evidence.findMany({
    where: { confirmed: true, consolidatedAt: null },
    orderBy: { id: "asc" },
  });
  // A stable primary key makes retries/reloads reuse the completed CV, without a schema change.
  const id = `role_${createHash("sha256")
    .update(
      JSON.stringify({
        generationPolicy: "two-full-pages-publications-v2",
        applicationId,
        postingRevision,
        profileRevision: profile.revision,
        baseCvId,
        baseRevision: base?.currentRevision,
        evidence: evidence.map((e) => [e.id, e.revision]),
      }),
    )
    .digest("hex")
    .slice(0, 40)}`;
  if (await db.cv.findUnique({ where: { id } })) return getCv(id);
  const sources = [
    {
      id: base
        ? `cv-${base.id}-${base.currentRevision}`
        : `profile-${profile.revision}`,
      title: base
        ? `Source CV · revision ${base.currentRevision}`
        : `Confirmed career details · revision ${profile.revision}`,
      text: contentText(content),
      publications: base ? undefined : publicationEntries(profile.content),
    },
    ...(base
      ? [
          {
            id: `profile-${profile.revision}`,
            title: `Confirmed career details · revision ${profile.revision}`,
            text: contentText(profile.content),
            publications: publicationEntries(profile.content),
          },
        ]
      : []),
    ...evidence.map((e) => ({
      id: `${e.id}-${e.revision}`,
      title: careerEvidenceTitle(profile.content, e),
      text: e.text,
    })),
  ];
  const proposal = await generateTailoring(content, application, sources);
  const { result } = await checkCvExports(proposal.content);
  if (!result.passed)
    throw new HttpError(
      422,
      "The tailored CV failed export validation. Your opportunity is saved; try tailoring again.",
    );
  try {
    await db.$transaction(async (tx) => {
      const liveApp = requireValue(
        await tx.application.findUnique({ where: { id: applicationId } }),
      );
      const liveProfile = requireValue(
        await tx.profile.findUnique({ where: { id: "main" } }),
      );
      const liveBase = base
        ? requireValue(await tx.cv.findUnique({ where: { id: base.id } }))
        : null;
      const liveEvidence = await tx.evidence.findMany({
        where: { confirmed: true, consolidatedAt: null },
        orderBy: { id: "asc" },
      });
      if (
        liveApp.postingRevision !== postingRevision ||
        liveProfile.revision !== profile.revision ||
        liveBase?.currentRevision !== base?.currentRevision ||
        JSON.stringify(liveEvidence.map((e) => [e.id, e.revision])) !==
          JSON.stringify(evidence.map((e) => [e.id, e.revision]))
      )
        throw new HttpError(
          409,
          "The posting or source evidence changed during tailoring. Your opportunity is saved; try again.",
        );
      await tx.cv.create({
        data: {
          id,
          title: `${application.role} — ${application.company}`.slice(0, 500),
          applicationId,
          profileRevision: profile.revision,
          currentRevision: 2,
          revisions: {
            create: [
              {
                number: 1,
                content,
                reason: base
                  ? "Original source CV before automatic tailoring"
                  : "Original confirmed career details before automatic tailoring",
              },
              {
                number: 2,
                content: proposal.content,
                reason:
                  "AI tailored automatically for this role · maximum two pages",
              },
            ],
          },
          suggestions: {
            create: proposal.changes.map((c) => ({
              baseRevision: 1,
              postingRevision,
              target: c.target,
              original: c.original,
              proposed: c.proposed,
              rationale: c.rationale,
              sources: sources.filter((s) => c.sourceIds.includes(s.id)),
              status: "generated",
            })),
          },
          exportChecks: {
            create: { cvRevision: 2, version: EXPORT_CHECK_VERSION, result },
          },
        },
      });
    });
  } catch (error) {
    // Concurrent completion of the same request is safe to reuse.
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002" &&
      (await db.cv.findUnique({ where: { id } }))
    ))
      throw error;
  }
  return getCv(id);
}
