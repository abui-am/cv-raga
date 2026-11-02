import "server-only";
import { z } from "zod";
import type { CvContent } from "@/lib/contracts";
import { CV_PAGE_LIMIT } from "@/lib/export-contracts";
import { measureCv } from "./export-quality";
import { HttpError } from "./http";
import { publicationEntries } from "@/lib/publications";

export const prioritySchema = z.object({
  target: z.string(),
  rank: z.number().int().min(1).max(100),
  reason: z.string().max(1000),
});
export type ContentPriority = z.infer<typeof prioritySchema>;
export function priorityTargets(content: CvContent) {
  return [
    { target: "summary", text: content.summary },
    { target: "skills", text: content.skills.join(" · ") },
    { target: "certifications", text: content.certifications.join("\n") },
    ...content.experience.map((e) => ({
      target: `experience:${e.id}`,
      text: [e.role, e.company, e.period, ...e.bullets].join("\n"),
    })),
    ...content.projects.map((p) => ({
      target: `projects:${p.id}`,
      text: [p.name, p.detail, ...p.bullets].join("\n"),
    })),
    ...content.education.map((e) => ({
      target: `education:${e.id}`,
      text: [e.qualification, e.institution, e.period].join("\n"),
    })),
  ];
}

/** Remove whole optional facts in AI priority order; never clip text, change facts or shrink type. */
export async function fitByPriority(
  content: CvContent,
  priorities: ContentPriority[],
) {
  let candidate = structuredClone(content);
  const reasons = new Map<string, string>();
  const positions = new Map(
    priorityTargets(content).map((p, index) => [p.target, index]),
  );
  const ordered = [...priorities].sort(
    (a, b) =>
      b.rank - a.rank || positions.get(b.target)! - positions.get(a.target)!,
  );
  const highest = (section: string) =>
    [...priorities]
      .filter((p) => p.target.startsWith(`${section}:`))
      .sort((a, b) => a.rank - b.rank)[0]
      ?.target.split(":")[1];
  const protectedRoles = new Set([
    content.experience[0]?.id,
    highest("experience"),
  ]);
  const protectedEducation = new Set([
    content.education[0]?.id,
    highest("education"),
  ]);
  for (const priority of ordered) {
    const [section, id] = priority.target.split(":");
    // A role gets a bullet-reduction step before any optional older-role omission.
    const steps = section === "experience" ? 2 : 1;
    for (let step = 0; step < steps; step++) {
      const next = structuredClone(candidate);
      let target = section;
      if (section === "summary") next.summary = "";
      else if (section === "skills") next.skills = next.skills.slice(0, 5);
      else if (section === "certifications")
        next.certifications = publicationEntries(next);
      else if (section === "projects")
        next.projects = next.projects.filter((p) => p.id !== id);
      else if (section === "education") {
        if (protectedEducation.has(id)) continue;
        next.education = next.education.filter((e) => e.id !== id);
      } else if (section === "experience") {
        if (step === 0) {
          const role = next.experience.find((e) => e.id === id);
          if (!role) continue;
          role.bullets = role.bullets.slice(0, protectedRoles.has(id) ? 1 : 0);
          target = `experience:${id}:bullets`;
        } else {
          if (protectedRoles.has(id)) continue;
          next.experience = next.experience.filter((e) => e.id !== id);
        }
      } else continue;
      if (JSON.stringify(next) === JSON.stringify(candidate)) continue;
      candidate = next;
      reasons.set(
        target,
        `Prioritized to fit two pages: ${priority.reason}. Lower-priority detail is preserved in the source CV.`,
      );
      if ((await measureCv(candidate)) <= CV_PAGE_LIMIT)
        return { content: candidate, reasons };
    }
  }
  throw new HttpError(
    422,
    "Even the essential CV content exceeds two pages after prioritization. Shorten unusually long contact details or role/education headings and try again. Your saved CV is unchanged.",
  );
}
