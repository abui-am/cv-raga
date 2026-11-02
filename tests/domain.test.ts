import { describe, expect, it } from "vitest";
import { emptyContent, type Requirement } from "../lib/contracts";
import {
  contentText,
  editableTargets,
  readiness,
  replaceTarget,
  scoreMatch,
  selectionPreview,
} from "../lib/domain";
import { createReviewStore } from "../features/cvs/review-store";
import { QueryClient } from "@tanstack/react-query";

const content = {
  ...emptyContent,
  name: "Alex Example",
  summary: "Developed React and TypeScript applications with unit tests.",
  skills: ["React", "TypeScript"],
};
const requirements: Requirement[] = [
  { id: "react", text: "React development", group: "required" },
  { id: "tests", text: "Unit testing", group: "responsibility" },
  { id: "bank", text: "Banking experience", group: "preferred" },
];
describe("explainable job match", () => {
  it("weights required, responsibilities and preferred groups, with partial credit", () => {
    const result = scoreMatch(
      requirements,
      [
        {
          requirementId: "react",
          status: "supported",
          cvQuote: "React and TypeScript applications",
          reason: "Clear evidence",
        },
        {
          requirementId: "tests",
          status: "partial",
          cvQuote: "with unit tests",
          reason: "No integration tests mentioned",
        },
        {
          requirementId: "bank",
          status: "absent",
          cvQuote: "",
          reason: "No banking evidence",
        },
      ],
      content,
    );
    expect(result.score).toBe(75);
    expect(result.items[2].status).toBe("absent");
  });
  it("rejects fabricated quotes and never scores the wider knowledge library", () => {
    const result = scoreMatch(
      requirements,
      [
        {
          requirementId: "bank",
          status: "supported",
          cvQuote: "Worked in banking for four years",
          reason: "Claim",
        },
      ],
      content,
    );
    expect(result.score).toBe(0);
    expect(result.items.every((i) => i.status === "absent")).toBe(true);
  });
  it("normalizes missing groups and ignores duplicate criteria and repeated keywords", () => {
    const result = scoreMatch(
      [
        { ...requirements[0] },
        { ...requirements[0], id: "duplicate", text: "  REACT development " },
      ],
      [
        {
          requirementId: "react",
          status: "supported",
          cvQuote: "React and TypeScript applications",
          reason: "Supported",
        },
      ],
      content,
    );
    expect(result.score).toBe(100);
    expect(result.items).toHaveLength(1);
    expect(scoreMatch([], [], content).score).toBe(0);
  });
});
describe("CV revisions and readiness", () => {
  it("removes and restores optional entries with readable review text and no source mutation", () => {
    const original = {
      ...content,
      projects: [
        {
          id: "project",
          name: "Legacy prototype",
          detail: "Side project",
          bullets: ["Built a prototype"],
        },
      ],
    };
    const selected = replaceTarget(original, "projects", "[]");
    expect(selected.projects).toEqual([]);
    expect(original.projects).toHaveLength(1);
    const restored = replaceTarget(
      selected,
      "projects",
      editableTargets(original).projects,
    );
    expect(restored).toEqual(original);
    expect(
      selectionPreview("projects", editableTargets(original).projects),
    ).toContain("Legacy prototype\nSide project\nBuilt a prototype");
    expect(selectionPreview("projects", "[]")).toContain(
      "Omitted from this CV",
    );
  });
  it("applies a targeted change without mutating the source", () => {
    const original = {
      ...content,
      experience: [
        {
          id: "role1",
          role: "Engineer",
          company: "Example",
          period: "2022–2025",
          bullets: ["Built apps", "Wrote tests"],
        },
      ],
    };
    const changed = replaceTarget(
      original,
      "experience:role1:0",
      "Developed applications",
    );
    expect(changed.experience[0].bullets).toEqual([
      "Developed applications",
      "Wrote tests",
    ]);
    expect(original.experience[0].bullets[0]).toBe("Built apps");
    expect(editableTargets(original)["experience:role1:1"]).toBe("Wrote tests");
    expect(() =>
      replaceTarget(original, "experience:missing:0", "No"),
    ).toThrow();
  });
  it("reports unknown export checks honestly and catches missing contact", () => {
    const checks = readiness(content);
    expect(checks.find((c) => c.label === "Name and contact")?.status).toBe(
      "Needs attention",
    );
    expect(checks.find((c) => c.label.includes("pagination"))?.status).toBe(
      "Not assessed",
    );
    expect(contentText(content)).toContain(content.summary);
  });
});
describe("workflow isolation", () => {
  it("isolates mounts and resets UI without clearing server cache", () => {
    const first = createReviewStore();
    const second = createReviewStore();
    const cache = new QueryClient();
    cache.setQueryData(["saved-record"], { title: "CV" });
    first.getState().setPanel("review");
    expect(second.getState().panel).toBe("preview");
    first.getState().reset();
    expect(first.getState().panel).toBe("preview");
    expect(cache.getQueryData(["saved-record"])).toEqual({ title: "CV" });
  });
});
