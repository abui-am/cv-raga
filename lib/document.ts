import type { CvContent } from "./contracts";

type Experience = CvContent["experience"][number];
const employment =
  /^(full[ -]?time|part[ -]?time|contract|freelance|internship|temporary|self[ -]?employed)(?:\s*\(([^)]+)\))?$/i;
const workMode = /^(remote|hybrid|on[ -]?site)$/i;

export function normalizeExperience(entry: Experience): Experience {
  let employmentType = entry.employmentType || "";
  let location = entry.location || "";
  let mode: NonNullable<Experience["workMode"]> = entry.workMode || "";
  const bullets = entry.bullets.filter((bullet) => {
    const value = bullet.replace(/^[•\s]+/, "").trim();
    const match = value.match(employment);
    if (match) {
      employmentType ||= match[1];
      location ||= match[2] || "";
      return false;
    }
    if (workMode.test(value)) {
      location ||= value;
      return false;
    }
    return true;
  });
  if (workMode.test(location)) {
    mode ||= /^remote$/i.test(location)
      ? "Remote"
      : /^hybrid$/i.test(location)
        ? "Hybrid"
        : "On-site";
    location = "";
  }
  if (mode === "Remote") location = "";
  return { ...entry, employmentType, workMode: mode, location, bullets };
}

const months = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
export function educationRecency(period: string) {
  if (/\b(present|current|ongoing|sekarang|saat ini)\b/i.test(period))
    return Number.POSITIVE_INFINITY;
  const dates = [
    ...period.matchAll(
      /\b(?:(jan\w*|feb\w*|mar\w*|apr\w*|may|mei|jun\w*|jul\w*|aug\w*|agu\w*|sep\w*|oct\w*|okt\w*|nov\w*|dec\w*|des\w*)\s+)?((?:19|20)\d{2})(?:[-/.](0?[1-9]|1[0-2]))?\b/gi,
    ),
  ];
  const end = dates.at(-1);
  if (!end) return Number.NEGATIVE_INFINITY;
  const month = end[1]
    ?.toLowerCase()
    .slice(0, 3)
    .replace("mei", "may")
    .replace("agu", "aug")
    .replace("okt", "oct")
    .replace("des", "dec");
  return (
    Number(end[2]) * 12 +
    (end[3] ? Number(end[3]) : month ? months.indexOf(month) + 1 : 0)
  );
}
export function normalizeDocument(content: CvContent): CvContent {
  return {
    ...content,
    languages: content.languages || [],
    experience: content.experience.map(normalizeExperience),
    education: [...content.education].sort((a, b) => {
      if (content.educationOrder?.length) {
        const first = content.educationOrder.indexOf(a.id);
        const second = content.educationOrder.indexOf(b.id);
        if (first !== second)
          return (
            (first < 0 ? Infinity : first) - (second < 0 ? Infinity : second)
          );
      }
      const first = educationRecency(a.period);
      const second = educationRecency(b.period);
      return first === second ? 0 : first < second ? 1 : -1;
    }),
  };
}
export function experienceMeta(entry: Experience) {
  const normalized = normalizeExperience(entry);
  return [
    [
      normalized.company,
      normalized.employmentType,
      normalized.workMode,
      normalized.location,
    ]
      .filter(Boolean)
      .join(" · "),
    normalized.period,
  ]
    .filter(Boolean)
    .join(" | ");
}
