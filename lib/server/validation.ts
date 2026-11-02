import "server-only";
import type { CvContent, Requirement } from "@/lib/contracts";
import { contentText } from "@/lib/domain";
import { HttpError } from "./http";

export function validateDocument(content: CvContent, draft = false) {
  if (!draft && !content.name.trim())
    throw new HttpError(400, "Add your name before saving this document.");
  if (contentText(content).length > 20000)
    throw new HttpError(
      400,
      "Keep the CV below 20,000 characters. Move additional career details to My career.",
    );
  for (const entries of [
    content.experience,
    content.education,
    content.projects,
  ]) {
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
      throw new HttpError(
        400,
        "Document entries need unique IDs. Review the imported draft.",
      );
  }
  return content;
}
export function validateRequirements(requirements: Requirement[]) {
  if (new Set(requirements.map((r) => r.id)).size !== requirements.length)
    throw new HttpError(400, "Each requirement needs a unique ID.");
  return requirements;
}
