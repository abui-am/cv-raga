import type { CvContent, EvidenceInput } from "./contracts";
import { normalizeDocument, experienceMeta } from "./document";
export function evidenceFromCv(
  input: CvContent,
): Omit<EvidenceInput, "sourceId">[] {
  const content = normalizeDocument(input);
  return [
    ...content.experience.map((e) => ({
      title: `${e.role} — ${e.company}`.slice(0, 500),
      kind: "Responsibility" as const,
      text: [experienceMeta(e), ...e.bullets].filter(Boolean).join("\n"),
      tags: [] as string[],
      confirmed: false,
    })),
    ...content.projects.map((p) => ({
      title: p.name,
      kind: "Project" as const,
      text: [p.detail, ...p.bullets].filter(Boolean).join("\n"),
      tags: [] as string[],
      confirmed: false,
    })),
    ...content.education.map((e) => ({
      title: e.qualification,
      kind: "Note" as const,
      text: [e.institution, e.period].filter(Boolean).join(" | "),
      tags: [] as string[],
      confirmed: false,
    })),
    ...content.certifications.map((text) => ({
      title: text.slice(0, 500),
      kind: "Note" as const,
      text,
      tags: [] as string[],
      confirmed: false,
    })),
  ].filter((item) => item.title.trim() && item.text.trim());
}
