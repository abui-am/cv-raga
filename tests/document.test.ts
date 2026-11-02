import { describe, expect, it } from "vitest";
import { emptyContent } from "../lib/contracts";
import {
  normalizeDocument,
  normalizeExperience,
  experienceMeta,
} from "../lib/document";
import { documentBlocks } from "../lib/template";
import { evidenceFromCv } from "../lib/knowledge-import";
import { inspectReadingOrder } from "../lib/server/export-quality";
import { validatePersonaResult, reviewerDefinitions } from "../lib/personas";
import type { PersonaResult } from "../lib/review-contracts";
import { normalizePublication } from "../lib/publications";

describe("CV layout and chronology", () => {
  it("respects an explicitly chosen education order while keeping chronological defaults", () => {
    const education = [
      {
        id: "older",
        institution: "Old school",
        qualification: "Degree",
        period: "2018–2022",
      },
      {
        id: "newer",
        institution: "New school",
        qualification: "Program",
        period: "2025–2026",
      },
    ];
    expect(
      normalizeDocument({ ...emptyContent, education }).education.map(
        (item) => item.id,
      ),
    ).toEqual(["newer", "older"]);
    const manual = {
      ...emptyContent,
      education,
      educationOrder: ["older", "newer"],
    };
    expect(normalizeDocument(manual).education.map((item) => item.id)).toEqual([
      "older",
      "newer",
    ]);
    expect(
      documentBlocks(manual).findIndex(
        (block) => block.text === "Old school | 2018–2022",
      ),
    ).toBeLessThan(
      documentBlocks(manual).findIndex(
        (block) => block.text === "New school | 2025–2026",
      ),
    );
    expect(education[0].id).toBe("older");
  });
  it("keeps publication URLs visible under a dedicated heading without duplicating schemes", () => {
    const publication =
      "- IEEE: Hybrid fine-tuning + RAG — ieeexplore.ieee.org/document/11715165";
    const normalized = normalizePublication(publication);
    expect(normalized).toBe(
      "IEEE: Hybrid fine-tuning + RAG — https://ieeexplore.ieee.org/document/11715165",
    );
    expect(normalizePublication(normalized)).toBe(normalized);
    const blocks = documentBlocks({
      ...emptyContent,
      certifications: [publication, "Example certification"],
    });
    expect(blocks).toContainEqual({ kind: "section", text: "Publications" });
    expect(blocks).toContainEqual({ kind: "bullet", text: normalized });
    expect(blocks).toContainEqual({
      kind: "section",
      text: "Certifications & awards",
    });
  });
  it("moves standalone employment metadata into one employer line and preserves real achievements", () => {
    const entry = {
      id: "role",
      role: "Engineer",
      company: "Example",
      period: "2022–2025",
      bullets: [
        "Full-time (Remote)",
        "Built remote monitoring tools",
        "Improved test coverage",
      ],
    };
    const normalized = normalizeExperience(entry);
    expect(experienceMeta(entry)).toBe(
      "Example · Full-time · Remote | 2022–2025",
    );
    expect(normalized.bullets).toEqual([
      "Built remote monitoring tools",
      "Improved test coverage",
    ]);
    expect(entry.bullets).toHaveLength(3);
    expect(
      normalizeExperience({ ...entry, workMode: "Remote", location: "Bali" })
        .location,
    ).toBe("");
    expect(
      experienceMeta({ ...entry, bullets: ["Full-time (Bandung)"] }),
    ).toContain("Full-time · Bandung");
  });
  it("sorts education latest first, keeps unknown dates stable, and does not mutate history", () => {
    const content = {
      ...emptyContent,
      education: [
        {
          id: "older",
          institution: "University",
          qualification: "Degree",
          period: "2018–2022",
        },
        {
          id: "recent",
          institution: "Academy",
          qualification: "Program",
          period: "Mar 2026 – Dec 2026",
        },
        {
          id: "current",
          institution: "School",
          qualification: "Course",
          period: "2025–Present",
        },
        {
          id: "unknown",
          institution: "Other",
          qualification: "Workshop",
          period: "",
        },
      ],
    };
    expect(normalizeDocument(content).education.map((e) => e.id)).toEqual([
      "current",
      "recent",
      "older",
      "unknown",
    ]);
    expect(content.education[0].id).toBe("older");
    const blocks = documentBlocks(content);
    expect(blocks.findIndex((b) => b.text === "Program")).toBeLessThan(
      blocks.findIndex((b) => b.text === "Degree"),
    );
  });
});
describe("export file inspection", () => {
  const blocks = [
    { kind: "entry" as const, text: "Engineer" },
    { kind: "meta" as const, text: "Example | 2022–2025" },
    { kind: "bullet" as const, text: "Built tested applications" },
  ];
  it("checks extraction order across real page boundaries", () => {
    expect(
      inspectReadingOrder(blocks, [
        "Engineer\nExample | 2022–2025",
        "Built tested applications",
      ]),
    ).toEqual({ readingOrder: true, headingGroups: true });
    expect(
      inspectReadingOrder(blocks, [
        "Example | 2022–2025\nEngineer\nBuilt tested applications",
      ]).readingOrder,
    ).toBe(false);
    expect(
      inspectReadingOrder(blocks, [
        "Engineer",
        "Example | 2022–2025\nBuilt tested applications",
      ]).headingGroups,
    ).toBe(false);
  });
});
describe("CV to career evidence", () => {
  it("creates distinct unconfirmed drafts with source wording rather than inventing achievements", () => {
    const content = {
      ...emptyContent,
      experience: [
        {
          id: "role",
          role: "Engineer",
          company: "Example",
          period: "2022–2025",
          bullets: ["Remote", "Built a React application"],
        },
      ],
      projects: [
        {
          id: "project",
          name: "Portal",
          detail: "React",
          bullets: ["Added accessible navigation"],
        },
      ],
    };
    const items = evidenceFromCv(content);
    expect(items).toHaveLength(2);
    expect(items.every((i) => !i.confirmed)).toBe(true);
    expect(items[0].text).toContain("Built a React application");
    expect(items[1].text).toContain("Added accessible navigation");
    expect(items[0].text).not.toContain("increased revenue");
  });
});
describe("persona evidence boundaries", () => {
  const result: PersonaResult = {
    summary: "A useful technical foundation.",
    criteria: reviewerDefinitions.TeamLead.criteria.map((c) => ({
      id: c.id,
      status: "evident",
      document: "cv",
      quote: "Built tested React applications",
      observation: "Evidence is clear",
      nextStep: "Explain the testing approach",
    })),
  };
  it("requires the correct role criteria and verifiable document quotes", () => {
    expect(
      validatePersonaResult("TeamLead", result, {
        cv: "Built tested React applications",
        cover_letter: "",
      }),
    ).toEqual(result);
    expect(() =>
      validatePersonaResult("HR", result, {
        cv: "Built tested React applications",
        cover_letter: "",
      }),
    ).toThrow();
    expect(() =>
      validatePersonaResult("TeamLead", result, {
        cv: "No such claim",
        cover_letter: "",
      }),
    ).toThrow("Unverifiable");
  });
  it("does not let a missing cover letter receive a positive review", () => {
    const hr: PersonaResult = {
      ...result,
      criteria: reviewerDefinitions.HR.criteria.map((c) => ({
        ...result.criteria[0],
        id: c.id,
      })),
    };
    expect(() =>
      validatePersonaResult("HR", hr, {
        cv: "Built tested React applications",
        cover_letter: "",
      }),
    ).toThrow("missing letter");
  });
});
