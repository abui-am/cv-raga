import "server-only";
import { database } from "./db";
import {
  applicationSchema,
  cvSchema,
  evidenceSchema,
  profileSchema,
  RUBRIC,
  type CvContent,
  type Application,
} from "@/lib/contracts";
import { HttpError, requireValue, wire } from "./http";
import { validateDocument } from "./validation";
import { normalizeDocument } from "@/lib/document";
import { PERSONA_RUBRIC } from "@/lib/review-contracts";
import { EXPORT_CHECK_VERSION } from "@/lib/export-contracts";

export async function getProfile() {
  const value = await database().profile.findUnique({ where: { id: "main" } });
  return value
    ? profileSchema.parse(
        wire({
          ...value,
          content: normalizeDocument(
            profileSchema.shape.content.parse(value.content),
          ),
        }),
      )
    : null;
}
export async function getApplication(id: string) {
  const value = requireValue(
    await database().application.findUnique({
      where: { id },
      include: { history: { orderBy: { createdAt: "desc" } } },
    }),
  );
  return applicationSchema.parse(wire(value));
}
export async function listApplications(
  search: string,
  status: Application["status"] | "",
) {
  const values = await database().application.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { company: { contains: search, mode: "insensitive" } },
              { role: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { history: { orderBy: { createdAt: "desc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return applicationSchema.array().parse(wire(values));
}
export async function getEvidence(id: string) {
  return evidenceSchema.parse(
    wire(
      requireValue(
        await database().evidence.findUnique({
          where: { id, consolidatedAt: null },
        }),
      ),
    ),
  );
}
export async function getCv(id: string) {
  const value = requireValue(
    await database().cv.findUnique({
      where: { id },
      include: {
        revisions: { orderBy: { number: "desc" } },
        suggestions: { orderBy: { createdAt: "desc" } },
        assessments: { orderBy: { createdAt: "desc" } },
        application: true,
        coverLetters: { orderBy: { number: "desc" } },
        reviewRuns: { orderBy: { createdAt: "desc" } },
        exportChecks: { orderBy: { createdAt: "desc" } },
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 200,
        },
      },
    }),
  );
  const currentLetter = value.coverLetters.find(
    (l) =>
      l.status === "accepted" &&
      l.cvRevision === value.currentRevision &&
      l.postingRevision === value.application?.postingRevision,
  );
  return cvSchema.parse(
    wire({
      ...value,
      messages: [...value.messages].reverse(),
      revisions: value.revisions.map((r) => ({
        ...r,
        content: normalizeDocument(
          profileSchema.shape.content.parse(r.content),
        ),
      })),
      coverLetters: value.coverLetters.map((l) => ({
        ...l,
        stale:
          l.cvRevision !== value.currentRevision ||
          l.postingRevision !== value.application?.postingRevision,
      })),
      reviewRuns: value.reviewRuns.map((r) => ({
        ...r,
        stale:
          r.cvRevision !== value.currentRevision ||
          r.postingRevision !== value.application?.postingRevision ||
          r.coverLetterId !== (currentLetter?.id ?? null) ||
          r.rubric !== PERSONA_RUBRIC,
      })),
      exportChecks: value.exportChecks.map((c) => ({
        ...c,
        stale:
          c.cvRevision !== value.currentRevision ||
          c.version !== EXPORT_CHECK_VERSION,
      })),
      assessments: value.assessments.map((a) => ({
        ...a,
        stale:
          a.cvRevision !== value.currentRevision ||
          a.postingRevision !== value.application?.postingRevision ||
          a.rubric !== RUBRIC,
      })),
    }),
  );
}
export async function reviseCv(
  id: string,
  expectedRevision: number,
  content: CvContent,
  reason: string,
  suggestionId?: string,
  suggestionStatus?: string,
  approvedText?: string,
) {
  validateDocument(content);
  await database().$transaction(async (tx) => {
    const update = await tx.cv.updateMany({
      where: { id, currentRevision: expectedRevision },
      data: { currentRevision: { increment: 1 } },
    });
    if (!update.count)
      throw new HttpError(
        409,
        "This CV changed in another window. Reload before saving.",
      );
    await tx.cvRevision.create({
      data: { cvId: id, number: expectedRevision + 1, content, reason },
    });
    if (suggestionId)
      await tx.suggestion.update({
        where: { id: suggestionId },
        data: {
          status: suggestionStatus,
          ...(approvedText !== undefined ? { proposed: approvedText } : {}),
        },
      });
  });
  return getCv(id);
}
