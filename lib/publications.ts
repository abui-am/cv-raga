import type { CvContent } from "./contracts";

export function isPublication(text: string) {
  return /\b(?:IEEE|ACM|publication|published paper)\b|doi\.org\/|arxiv\.org\/|ieeexplore\.ieee\.org\//i.test(
    text,
  );
}
export function normalizePublication(text: string) {
  return text
    .trim()
    .replace(/^[-•]\s*/, "")
    .replace(
      /(?<![\w/])(?<!https:\/\/)(?<!http:\/\/)((?:ieeexplore\.ieee\.org\/document\/|doi\.org\/|arxiv\.org\/(?:abs|pdf)\/)[^\s]+)/gi,
      "https://$1",
    );
}
export function publicationEntries(content: CvContent) {
  return [
    ...new Set(
      content.certifications.filter(isPublication).map(normalizePublication),
    ),
  ];
}
export function preservePublications(content: CvContent, required: string[]) {
  if (!required.length) return content;
  return {
    ...content,
    certifications: [
      ...required,
      ...content.certifications.filter((text) => !isPublication(text)),
    ],
  };
}
