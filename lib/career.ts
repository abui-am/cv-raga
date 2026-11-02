import type { CvContent } from "./contracts";
import { normalize } from "./domain";
import { evidenceFromCv } from "./knowledge-import";

export function careerEntries(content: CvContent) {
  return [
    ...content.experience.map((entry) => ({
      id: `experience:${entry.id}`,
      label: `${entry.role} — ${entry.company}`,
    })),
    ...content.projects.map((entry) => ({
      id: `projects:${entry.id}`,
      label: entry.name,
    })),
    ...content.education.map((entry) => ({
      id: `education:${entry.id}`,
      label: `${entry.qualification} — ${entry.institution}`,
    })),
  ];
}

export function careerEvidenceTitle(
  content: CvContent | undefined,
  evidence: { title: string; careerEntryId?: string | null },
) {
  const entry =
    content &&
    careerEntries(content).find((item) => item.id === evidence.careerEntryId);
  return entry
    ? `${evidence.title} · ${entry.label}`.slice(0, 500)
    : evidence.title;
}

export function isCareerFact(content: CvContent, text: string) {
  const value = normalize(text);
  return (
    Boolean(value) &&
    [
      ...evidenceFromCv(content).map((item) => item.text),
      ...content.experience.flatMap((entry) => entry.bullets),
      ...content.projects.flatMap((entry) => entry.bullets),
      ...content.certifications,
      ...(content.languages || []),
    ].some((fact) => normalize(fact) === value)
  );
}

/** Preserve existing IDs when repeated imports propose updates to the same entry. */
export function mergeCareer(
  current: CvContent,
  imported: CvContent,
): CvContent {
  const next = structuredClone(current);
  for (const field of [
    "name",
    "headline",
    "email",
    "phone",
    "location",
    "summary",
  ] as const)
    if (!next[field]) next[field] = imported[field];
  for (const field of ["links", "skills", "certifications"] as const) {
    const seen = new Set(next[field].map(normalize));
    next[field] = [
      ...next[field],
      ...imported[field].filter((value) => {
        const key = normalize(value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    ];
  }
  const mergeBullets = (existing: string[], additions: string[]) => {
    const seen = new Set(existing.map(normalize));
    return [
      ...existing,
      ...additions.filter((value) => {
        const key = normalize(value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    ];
  };
  if (current.languages || imported.languages)
    next.languages = mergeBullets(
      current.languages || [],
      imported.languages || [],
    );
  for (const entry of imported.experience) {
    const existing = next.experience.find(
      (value) =>
        normalize(value.role) === normalize(entry.role) &&
        normalize(value.company) === normalize(entry.company) &&
        normalize(value.period) === normalize(entry.period),
    );
    if (existing)
      existing.bullets = mergeBullets(existing.bullets, entry.bullets);
    else next.experience.push({ ...entry, id: crypto.randomUUID() });
  }
  for (const entry of imported.projects) {
    const existing = next.projects.find(
      (value) => normalize(value.name) === normalize(entry.name),
    );
    if (existing)
      existing.bullets = mergeBullets(existing.bullets, entry.bullets);
    else next.projects.push({ ...entry, id: crypto.randomUUID() });
  }
  for (const entry of imported.education) {
    const existing = next.education.some(
      (value) =>
        normalize(value.qualification) === normalize(entry.qualification) &&
        normalize(value.institution) === normalize(entry.institution) &&
        normalize(value.period) === normalize(entry.period),
    );
    if (!existing) next.education.push({ ...entry, id: crypto.randomUUID() });
  }
  return next;
}
