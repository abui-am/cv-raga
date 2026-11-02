import type { CvContent } from "./contracts";
import { experienceMeta, normalizeDocument } from "./document";
import { isPublication, publicationEntries } from "./publications";

export const template = {
  id: "ats-classic-v1",
  name: "ATS Classic",
  font: "Carlito",
  width: 612,
  height: 792,
  margin: 42,
  bodySize: 11,
  nameSize: 22,
  headingSize: 11,
  lineHeight: 1.25,
} as const;
export type DocumentBlock = {
  kind: "name" | "contact" | "section" | "entry" | "meta" | "text" | "bullet";
  text: string;
};
export function documentBlocks(input: CvContent): DocumentBlock[] {
  const content = normalizeDocument(input);
  const blocks: DocumentBlock[] = [];
  const add = (kind: DocumentBlock["kind"], text: string) => {
    if (text.trim()) blocks.push({ kind, text });
  };
  add("name", content.name);
  add("contact", content.headline);
  add(
    "contact",
    [content.location, content.email, content.phone]
      .filter(Boolean)
      .join(" | "),
  );
  add("contact", content.links.filter(Boolean).join(" | "));
  if (content.summary.trim()) {
    add("section", "Professional summary");
    add("text", content.summary);
  }
  if (content.skills.length) {
    add("section", "Technical skills");
    add("text", content.skills.join(" · "));
  }
  if (content.languages?.length) {
    add("section", "Languages");
    add("text", content.languages.join(" · "));
  }
  if (content.experience.length) {
    add("section", "Professional experience");
    content.experience.forEach((e) => {
      add("entry", e.role);
      add("meta", experienceMeta(e));
      e.bullets.forEach((b) => add("bullet", b));
    });
  }
  if (content.projects.length) {
    add("section", "Programs & projects");
    content.projects.forEach((p) => {
      add("entry", p.name);
      add("meta", p.detail);
      p.bullets.forEach((b) => add("bullet", b));
    });
  }
  if (content.education.length) {
    add("section", "Education");
    content.education.forEach((e) => {
      add("entry", e.qualification);
      add("meta", [e.institution, e.period].filter(Boolean).join(" | "));
    });
  }
  const publications = publicationEntries(content);
  if (publications.length) {
    add("section", "Publications");
    publications.forEach((publication) => add("bullet", publication));
  }
  const certifications = content.certifications.filter(
    (text) => !isPublication(text),
  );
  if (certifications.length) {
    add("section", "Certifications & awards");
    certifications.forEach((c) => add("bullet", c));
  }
  return blocks;
}
