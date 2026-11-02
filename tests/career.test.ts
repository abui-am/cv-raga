import { expect, it } from "vitest";
import { emptyContent } from "../lib/contracts";
import {
  careerEntries,
  careerEvidenceTitle,
  isCareerFact,
  mergeCareer,
} from "../lib/career";
import { evidenceFromCv } from "../lib/knowledge-import";

const career = {
  ...emptyContent,
  name: "Alex Example",
  skills: ["React"],
  experience: [
    {
      id: "role1",
      role: "Engineer",
      company: "Example",
      period: "2024–Present",
      bullets: ["Built accessible interfaces."],
    },
  ],
  projects: [
    {
      id: "project1",
      name: "Dashboard",
      detail: "React",
      bullets: ["Added integration tests."],
    },
  ],
  education: [
    {
      id: "education1",
      institution: "Example University",
      qualification: "BSc",
      period: "2020",
    },
  ],
};

it("merges stated languages without duplicating matching proficiency and recognizes shared language facts", () => {
  const languages = [
    "English — B2 (Upper Intermediate)",
    "Indonesian — Native",
  ];
  const merged = mergeCareer(
    { ...career, languages: [languages[0]] },
    { ...emptyContent, languages },
  );
  expect(merged.languages).toEqual(languages);
  expect(isCareerFact(merged, languages[1])).toBe(true);
  expect(isCareerFact(merged, "English — C1")).toBe(false);
});

it("merges repeated career imports while preserving entry IDs, existing fields, and unique supporting details", () => {
  const imported = structuredClone(career);
  imported.name = "An imported name";
  imported.skills = ["react", "TypeScript"];
  imported.experience[0].id = "imported1";
  imported.experience[0].bullets[0] = "built accessible interfaces.";
  imported.experience[0].bullets.push("Reduced build times by 20%.");
  imported.projects[0].id = "imported2";
  imported.education[0].id = "imported3";
  const merged = mergeCareer(career, imported);
  expect(merged.name).toBe("Alex Example");
  expect(merged.skills).toEqual(["React", "TypeScript"]);
  expect(merged.experience).toHaveLength(1);
  expect(merged.experience[0].id).toBe("role1");
  expect(merged.experience[0].bullets).toHaveLength(2);
  expect(merged.experience[0].bullets[0]).toBe("Built accessible interfaces.");
  expect(merged.projects[0].id).toBe("project1");
  expect(merged.education[0].id).toBe("education1");
  expect(mergeCareer(merged, imported)).toEqual(merged);
  expect(career.experience[0].bullets).toHaveLength(1);
});

it("recognizes whole legacy imports and exact career facts without suppressing additional evidence", () => {
  for (const item of evidenceFromCv(career))
    expect(isCareerFact(career, item.text)).toBe(true);
  expect(isCareerFact(career, "  BUILT accessible\ninterfaces. ")).toBe(true);
  expect(
    isCareerFact(
      career,
      "Built accessible interfaces. Reduced support requests by 12%.",
    ),
  ).toBe(false);
  expect(isCareerFact(career, "")).toBe(false);
});

it("keeps stable, distinct links when entries in different career sections share an ID", () => {
  const content = {
    ...career,
    projects: [{ ...career.projects[0], id: "role1" }],
  };
  expect(careerEntries(content).map((entry) => entry.id)).toEqual([
    "experience:role1",
    "projects:role1",
    "education:education1",
  ]);
});

it("supplies current career-entry context to tailoring without copying the shared fact into evidence", () => {
  const evidence = {
    title: "Reduced support requests",
    careerEntryId: "experience:role1",
  };
  expect(careerEvidenceTitle(career, evidence)).toBe(
    "Reduced support requests · Engineer — Example",
  );
  const renamed = structuredClone(career);
  renamed.experience[0].role = "Senior Engineer";
  expect(careerEvidenceTitle(renamed, evidence)).toContain(
    "Senior Engineer — Example",
  );
  expect(careerEvidenceTitle(emptyContent, evidence)).toBe(evidence.title);
});
