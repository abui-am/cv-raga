import { afterEach, expect, it, vi } from "vitest";
import { emptyContent } from "../lib/contracts";
const mocks = vi.hoisted(() => ({ ask: vi.fn() }));
vi.mock("../lib/server/ai", () => ({ askAi: mocks.ask }));
import { planRefinement } from "../lib/server/refinement-plan";
import { selectEvidence } from "../lib/evidence-selection";
import {
  improvesChecks,
  preservesChecks,
  unmetRequirements,
} from "../lib/refinement-policy";
const requirements = [
  {
    id: "testing",
    text: "Able to test applications",
    group: "required" as const,
  },
  { id: "k8s", text: "Kubernetes experience", group: "preferred" as const },
];
const checklist = {
  requirements,
  items: requirements.map((r) => ({
    requirementId: r.id,
    status: "absent" as const,
  })),
};
const sources = [
  {
    id: "profile-1",
    title: "Confirmed career",
    text: "Wrote regression tests and investigated session defects. Deployed the API using Docker.",
  },
];
afterEach(() => vi.resetAllMocks());
it("grounds a general skill in documented behavior and asks only about the missing specific qualification", async () => {
  mocks.ask.mockResolvedValue({
    checks: [
      {
        requirementId: "testing",
        basis: "inferred_general",
        generalSkill: "Testing",
        reason: "Regression tests demonstrate testing.",
        evidence: [{ sourceId: "s1", quote: "Wrote regression tests" }],
        question: "",
      },
      {
        requirementId: "k8s",
        basis: "needs_answer",
        generalSkill: "",
        reason: "Docker does not establish Kubernetes.",
        evidence: [],
        question:
          "Have you deployed or operated Kubernetes in a project, and what did you personally handle?",
      },
    ],
  });
  const plan = await planRefinement(emptyContent, checklist, sources);
  expect(plan[0].basis).toBe("inferred_general");
  expect(plan[0].evidence[0].sourceId).toBe("profile-1");
  expect(plan[0].question).toBe("");
  expect(plan[1].question).toContain("Kubernetes");
  expect(plan[1].evidence).toEqual([]);
});
it("treats invented proof and omitted criteria as questions rather than evidence", async () => {
  mocks.ask.mockResolvedValue({
    checks: [
      {
        requirementId: "testing",
        basis: "direct",
        generalSkill: "",
        reason: "Unsupported",
        evidence: [{ sourceId: "s1", quote: "Invented testing certificate" }],
        question: "",
      },
    ],
  });
  const plan = await planRefinement(emptyContent, checklist, sources);
  expect(
    plan.every(
      (check) => check.basis === "needs_answer" && check.evidence.length === 0,
    ),
  ).toBe(true);
  expect(plan[0].question).toContain("Able to test applications");
  expect(plan[1].question).toContain("Kubernetes experience");
});
it("finds relevant evidence late in a large library and keeps excerpts contiguous", () => {
  const library = [
    sources[0],
    ...Array.from({ length: 70 }, (_, i) => ({
      id: `note-${i}`,
      title: `Note ${i}`,
      text: "Unrelated supporting detail. ".repeat(350),
    })),
    {
      id: "late-kubernetes",
      title: "Production deployment",
      text:
        "Earlier context. ".repeat(300) +
        "Operated Kubernetes deployments, configured health probes and rolled out application updates.",
    },
  ];
  const selected = selectEvidence(library, requirements);
  expect(JSON.stringify(selected).length).toBeLessThanOrEqual(110000);
  expect(selected[0]).toEqual(sources[0]);
  const found = selected.find((source) => source.id === "late-kubernetes");
  expect(found?.text).toContain("Operated Kubernetes deployments");
  expect(library.at(-1)!.text).toContain(found!.text);
});
it("preserves filled checks and recognizes same-score checklist progress", () => {
  const before = {
    requirements,
    items: [
      { requirementId: "testing", status: "supported" as const },
      { requirementId: "k8s", status: "partial" as const },
    ],
  };
  const regression = {
    requirements,
    items: [
      { requirementId: "testing", status: "absent" as const },
      { requirementId: "k8s", status: "supported" as const },
    ],
  };
  const after = {
    requirements,
    items: requirements.map((r) => ({
      requirementId: r.id,
      status: "supported" as const,
    })),
  };
  expect(preservesChecks(before, regression)).toBe(false);
  expect(improvesChecks(before, after)).toBe(true);
  expect(unmetRequirements(after)).toEqual([]);
});
