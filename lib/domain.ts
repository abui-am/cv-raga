import {
  cvContentSchema,
  type CvContent,
  type MatchItem,
  type Requirement,
} from "./contracts";
import { normalizeDocument } from "./document";

export function contentText(input: CvContent) {
  const content = normalizeDocument(input);
  return [
    content.name,
    content.headline,
    content.email,
    content.phone,
    content.location,
    ...content.links,
    content.summary,
    ...content.skills,
    ...(content.languages || []),
    ...content.experience.flatMap((e) => [
      e.role,
      e.company,
      e.employmentType || "",
      e.workMode || "",
      e.location || "",
      e.period,
      ...e.bullets,
    ]),
    ...content.projects.flatMap((p) => [p.name, p.detail, ...p.bullets]),
    ...content.education.flatMap((e) => [
      e.institution,
      e.qualification,
      e.period,
    ]),
    ...content.certifications,
  ].join("\n");
}
export function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
export function uniqueRequirements(requirements: Requirement[]) {
  const seen = new Set<string>();
  return requirements.filter((r) => {
    const key = normalize(r.text);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function scoreMatch(
  requirements: Requirement[],
  items: MatchItem[],
  content: CvContent,
) {
  const cvText = normalize(contentText(content));
  const verified = uniqueRequirements(requirements).map((requirement) => {
    const item = items.find((i) => i.requirementId === requirement.id);
    if (
      !item ||
      (item.status !== "absent" &&
        (normalize(item.cvQuote).length < 8 ||
          !cvText.includes(normalize(item.cvQuote))))
    ) {
      return {
        requirementId: requirement.id,
        status: "absent" as const,
        cvQuote: "",
        reason: "No verifiable supporting quote was found in this CV revision.",
      };
    }
    return item;
  });
  const weights = { required: 60, responsibility: 30, preferred: 10 };
  let weighted = 0;
  let available = 0;
  for (const [group, weight] of Object.entries(weights)) {
    const groupRequirements = uniqueRequirements(requirements).filter(
      (r) => r.group === group,
    );
    if (!groupRequirements.length) continue;
    available += weight;
    const credit = groupRequirements.reduce((sum, r) => {
      const item = verified.find((i) => i.requirementId === r.id)!;
      return (
        sum +
        (item.status === "supported" ? 1 : item.status === "partial" ? 0.5 : 0)
      );
    }, 0);
    weighted += (weight * credit) / groupRequirements.length;
  }
  return {
    score: available ? Math.round((100 * weighted) / available) : 0,
    items: verified,
  };
}
export function readiness(content: CvContent) {
  return [
    {
      label: "Readable text",
      status:
        contentText(content).trim().length > 100 ? "Pass" : "Needs attention",
      detail: "Enough real text for a parser to read.",
    },
    {
      label: "Name and contact",
      status:
        content.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.email)
          ? "Pass"
          : "Needs attention",
      detail: "Name and a readable email in the document body.",
    },
    {
      label: "Professional experience",
      status: content.experience.some(
        (e) => e.role && e.company && e.bullets.some((b) => b.trim()),
      )
        ? "Pass"
        : "Needs attention",
      detail: "Role, employer and at least one descriptive bullet.",
    },
    {
      label: "Skills",
      status: content.skills.some((s) => s.trim()) ? "Pass" : "Needs attention",
      detail: "A plain-text skills section.",
    },
    {
      label: "Consistent template",
      status: "Pass",
      detail:
        "ATS Classic: one column, normal text flow, no layout tables or photos.",
    },
    {
      label: "Export reading order and pagination",
      status: "Not assessed",
      detail:
        "Inspect the exported file. This checklist does not inspect a downloaded artifact.",
    },
  ];
}
export function editableTargets(content: CvContent) {
  const targets: Record<string, string> = {
    summary: content.summary,
    skills: content.skills.join("\n"),
    certifications: content.certifications.join("\n"),
    experience: JSON.stringify(content.experience),
    projects: JSON.stringify(content.projects),
    education: JSON.stringify(content.education),
  };
  content.experience.forEach((e) => {
    targets[`experience:${e.id}:bullets`] = e.bullets.join("\n");
  });
  content.projects.forEach((p) => {
    targets[`projects:${p.id}:bullets`] = p.bullets.join("\n");
  });
  content.experience.forEach((e) =>
    e.bullets.forEach((b, i) => {
      targets[`experience:${e.id}:${i}`] = b;
    }),
  );
  content.projects.forEach((p) =>
    p.bullets.forEach((b, i) => {
      targets[`projects:${p.id}:${i}`] = b;
    }),
  );
  return targets;
}
export function tailoringTargets(content: CvContent) {
  return Object.fromEntries(
    Object.entries(editableTargets(content)).filter(
      ([key]) => !/:(\d+)$/.test(key) && !isSelectionTarget(key),
    ),
  );
}
export function isSelectionTarget(
  target: string,
): target is "experience" | "projects" | "education" {
  return ["experience", "projects", "education"].includes(target);
}

export function selectionPreview(target: string, value: string) {
  if (!isSelectionTarget(target)) return value;
  try {
    const entries = cvContentSchema.shape[target].parse(JSON.parse(value));
    return (
      entries
        .map((entry) => {
          if ("role" in entry)
            return [
              entry.role,
              `${entry.company} | ${entry.period}`,
              ...entry.bullets,
            ].join("\n");
          if ("name" in entry)
            return [entry.name, entry.detail, ...entry.bullets].join("\n");
          return [
            entry.qualification,
            `${entry.institution} | ${entry.period}`,
          ].join("\n");
        })
        .join("\n\n") ||
      "Omitted from this CV to prioritize the role. Preserved in the original version."
    );
  } catch {
    return value;
  }
}
export function replaceTarget(
  content: CvContent,
  target: string,
  value: string,
): CvContent {
  const next = structuredClone(content);
  if (!(target in editableTargets(next)))
    throw new Error(
      "This change no longer matches the CV. Generate a new proposal.",
    );
  if (isSelectionTarget(target)) {
    const parsed = JSON.parse(value);
    if (target === "experience")
      next.experience = cvContentSchema.shape.experience.parse(parsed);
    else if (target === "projects")
      next.projects = cvContentSchema.shape.projects.parse(parsed);
    else next.education = cvContentSchema.shape.education.parse(parsed);
  } else if (target === "summary") next.summary = value;
  else if (target === "skills" || target === "certifications")
    next[target] = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  else {
    const [section, id, index] = target.split(":");
    const entry = (
      section === "experience" ? next.experience : next.projects
    ).find((e) => e.id === id)!;
    if (index === "bullets")
      entry.bullets = value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    else entry.bullets[Number(index)] = value;
  }
  return next;
}
export function applyProposal(
  content: CvContent,
  changes: { target: string; original: string; proposed: string }[],
) {
  let proposed = content;
  for (const change of changes) {
    if (editableTargets(proposed)[change.target] !== change.original)
      throw new Error(
        "A proposed section changed. Generate a fresh tailoring proposal.",
      );
    proposed = replaceTarget(proposed, change.target, change.proposed);
  }
  return proposed;
}
