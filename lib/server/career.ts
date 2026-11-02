import "server-only";
import { cvContentSchema, type CvContent } from "@/lib/contracts";
import { careerEntries, isCareerFact } from "@/lib/career";
import { workspaceId } from "./workspace";
import { database } from "./db";
import { HttpError } from "./http";
import { getProfile } from "./records";

export async function saveCareer(content: CvContent, revision: number) {
  await database().$transaction(async (tx) => {
    const previous = await tx.profile.findUnique({ where: { id: "main" } });
    if ((previous?.revision ?? 0) !== revision)
      throw new HttpError(
        409,
        "Your career changed in another window. Reload before saving.",
      );
    if (!previous) await tx.profile.create({ data: { content } });
    else {
      const update = await tx.profile.updateMany({
        where: { id: "main", revision },
        data: { content, revision: { increment: 1 } },
      });
      if (!update.count)
        throw new HttpError(
          409,
          "Your career changed in another window. Reload before saving.",
        );
    }
    const oldContent = previous
      ? cvContentSchema.parse(previous.content)
      : null;
    const entries = new Set(careerEntries(content).map((entry) => entry.id));
    const evidence = await tx.evidence.findMany({
      where: { consolidatedAt: null },
    });
    for (const item of evidence) {
      const duplicate =
        isCareerFact(content, item.text) ||
        (oldContent && isCareerFact(oldContent, item.text));
      const detached = item.careerEntryId && !entries.has(item.careerEntryId);
      if (!duplicate && !detached) continue;
      const updated = await tx.evidence.updateMany({
        where: { id: item.id, revision: item.revision },
        data: {
          ...(duplicate ? { consolidatedAt: new Date() } : {}),
          ...(detached ? { careerEntryId: null } : {}),
          revision: { increment: 1 },
        },
      });
      if (!updated.count)
        throw new HttpError(
          409,
          "Supporting evidence changed. Reload before saving your career.",
        );
    }
  });
  return getProfile();
}

export async function validateCareerEvidence(
  tx: Pick<ReturnType<typeof database>, "profile" | "$queryRaw">,
  text: string,
  careerEntryId?: string | null,
) {
  // Serialize linked-evidence writes with career edits so removed entries cannot
  // acquire a new dangling link between validation and commit.
  await tx.$queryRaw`SELECT id FROM "Profile" WHERE id = ${workspaceId()} AND "ownerId" = ${workspaceId()} FOR UPDATE`;
  const record = await tx.profile.findUnique({ where: { id: "main" } });
  const profile = record
    ? { content: cvContentSchema.parse(record.content) }
    : null;
  if (
    careerEntryId &&
    (!profile ||
      !careerEntries(profile.content).some(
        (entry) => entry.id === careerEntryId,
      ))
  )
    throw new HttpError(
      409,
      "This career entry changed. Reload and choose its current role or project.",
    );
  if (profile && isCareerFact(profile.content, text))
    throw new HttpError(
      400,
      "This fact is already in your career history. Edit it there, or add supporting detail here.",
    );
}
