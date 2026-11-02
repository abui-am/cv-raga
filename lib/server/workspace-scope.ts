import "server-only";
import { HttpError } from "./http";

type Data = Record<string, unknown>;
const models = new Set([
  "Profile",
  "Source",
  "Evidence",
  "OpenQuestion",
  "Application",
  "StatusEvent",
  "Cv",
  "CvRevision",
  "Suggestion",
  "Assessment",
  "CoverLetter",
  "ReviewRun",
  "CvMessage",
  "Repository",
  "ExportCheck",
]);
const nested: Record<string, string> = {
  history: "StatusEvent",
  revisions: "CvRevision",
  suggestions: "Suggestion",
  assessments: "Assessment",
  coverLetters: "CoverLetter",
  reviewRuns: "ReviewRun",
  exportChecks: "ExportCheck",
  messages: "CvMessage",
  evidence: "Evidence",
  openQuestions: "OpenQuestion",
  cvs: "Cv",
};
const relations = new Set([
  ...Object.keys(nested),
  "source",
  "evidence",
  "application",
  "cv",
  "coverLetter",
  "submittedRevision",
  "submittedFor",
]);
function stamp(
  model: string,
  value: unknown,
  ownerId: string,
  create: boolean,
) {
  for (const row of Array.isArray(value) ? value : [value]) {
    if (!row || typeof row !== "object") continue;
    const data = row as Data;
    if (!create && ("ownerId" in data || "id" in data))
      throw new HttpError(400, "Record ownership cannot be changed.");
    if (create) {
      data.ownerId = ownerId;
      if (model === "Profile") data.id = ownerId;
    }
    for (const [key, val] of Object.entries(data)) {
      if (!relations.has(key) || val == null) continue;
      const write = val as Data;
      // Support only the nested creates used by this app. Other relation writes
      // must go through a scoped top-level delegate and database ownership checks.
      if (!nested[key] || Object.keys(write).some((k) => k !== "create"))
        throw new HttpError(400, "Unsupported workspace relation update.");
      stamp(nested[key], write.create, ownerId, true);
    }
  }
}
export function scopeOperation(
  model: string,
  operation: string,
  value: unknown,
  ownerId: string,
) {
  if (!models.has(model))
    throw new HttpError(403, "This record is unavailable in the workspace.");
  const args = value as Data;
  if (
    operation === "create" ||
    operation === "createMany" ||
    operation === "createManyAndReturn"
  ) {
    stamp(model, args.data, ownerId, true);
    return;
  }
  const where = (args.where ?? {}) as Data;
  if (model === "Profile" && where.id === "main") where.id = ownerId;
  if (model === "Repository" && "path" in where) {
    where.ownerId_path = { ownerId, path: where.path };
    delete where.path;
  }
  where.ownerId = ownerId;
  args.where = where;
  if (operation === "upsert") {
    stamp(model, args.create, ownerId, true);
    stamp(model, args.update, ownerId, false);
  } else if (operation.startsWith("update"))
    stamp(model, args.data, ownerId, false);
}
