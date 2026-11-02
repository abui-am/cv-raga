import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyContent, type MatchItem } from "../lib/contracts";
import { applyProposal } from "../lib/domain";
const mocks = vi.hoisted(() => ({
  cv: vi.fn(),
  app: vi.fn(),
  assess: vi.fn(),
  evaluate: vi.fn(),
  generate: vi.fn(),
  sources: vi.fn(),
  refine: vi.fn(),
  measure: vi.fn(),
  transaction: vi.fn(),
  messages: vi.fn(),
  plan: vi.fn(),
}));
vi.mock("../lib/server/records", () => ({
  getCv: mocks.cv,
  getApplication: mocks.app,
}));
vi.mock("../lib/server/match", () => ({
  assessCv: mocks.assess,
  evaluateMatch: mocks.evaluate,
}));
vi.mock("../lib/server/tailoring", async (original) => ({
  ...(await original<typeof import("../lib/server/tailoring")>()),
  generateTailoring: mocks.generate,
}));
vi.mock("../lib/server/refine-cv", () => ({
  refinementSources: mocks.sources,
  refineCv: mocks.refine,
}));
vi.mock("../lib/server/export-quality", () => ({
  measureCvLayout: mocks.measure,
}));
vi.mock("../lib/server/refinement-plan", () => ({
  planRefinement: mocks.plan,
}));
vi.mock("../lib/server/db", () => ({
  database: () => ({ $transaction: mocks.transaction }),
}));
import { optimizeMatch } from "../lib/server/optimize-match";
const content = {
  ...emptyContent,
  name: "Alex Example",
  summary: "Built React applications",
};
const requirements = [
  { id: "react", text: "React applications", group: "required" as const },
];
const evaluation = (
  score: number,
  status: MatchItem["status"] = "partial",
) => ({
  score,
  result: {
    requirements,
    items: [
      {
        requirementId: "react",
        status,
        cvQuote: "React applications",
        reason: "Some evidence",
      },
    ],
    model: "test-model",
  },
});
const cv = {
  id: "cv1",
  applicationId: "job1",
  currentRevision: 1,
  revisions: [{ content }],
  assessments: [{ ...evaluation(40), stale: false }],
};
beforeEach(() => {
  mocks.plan.mockResolvedValue([
    {
      requirementId: "react",
      basis: "needs_answer",
      question: "Which React applications did you personally build?",
    },
  ]);
  mocks.cv.mockResolvedValue(cv);
  mocks.app.mockResolvedValue({ id: "job1", postingRevision: 1, requirements });
  mocks.sources.mockResolvedValue({
    profile: null,
    evidence: [],
    sources: [{ id: "cv-cv1-1", title: "Original CV", text: content.summary }],
  });
  mocks.measure.mockResolvedValue({
    pages: 2,
    pageFill: [0.98, 0.97],
    full: true,
  });
  mocks.generate.mockImplementation(async (base) => ({
    content: { ...base, summary: `${base.summary} with testing` },
    changes: [
      {
        target: "summary",
        original: base.summary,
        proposed: `${base.summary} with testing`,
        rationale: "Clarify supported testing",
        sourceIds: ["cv-cv1-1"],
      },
    ],
  }));
  mocks.evaluate.mockResolvedValue(evaluation(60));
  mocks.transaction.mockImplementation(async (fn) =>
    fn({
      cv: { findUnique: mocks.cv },
      application: { findUnique: mocks.app },
      cvMessage: { createMany: mocks.messages },
    }),
  );
});
afterEach(() => vi.resetAllMocks());
it("keeps the highest-scoring candidate and discards a later regression", async () => {
  mocks.evaluate
    .mockResolvedValueOnce(evaluation(70))
    .mockResolvedValueOnce(evaluation(55));
  await optimizeMatch("cv1");
  expect(mocks.refine).toHaveBeenCalledTimes(1);
  const options = mocks.refine.mock.calls[0][4];
  expect(options.assessment.score).toBe(70);
  expect(options.prepared.proposal.content.summary).toBe(
    "Built React applications with testing",
  );
  expect(options.reply).toContain("40/100 → 70/100");
});
it("combines two improving rounds against the original accepted revision", async () => {
  mocks.evaluate
    .mockResolvedValueOnce(evaluation(60))
    .mockResolvedValueOnce(evaluation(80));
  await optimizeMatch("cv1");
  const proposal = mocks.refine.mock.calls[0][4].prepared.proposal;
  expect(proposal.changes[0].original).toBe(content.summary);
  expect(applyProposal(content, proposal.changes)).toEqual(proposal.content);
  expect(mocks.refine.mock.calls[0][4].assessment.score).toBe(80);
});
it("leaves the CV untouched when no supported candidate improves its score", async () => {
  mocks.evaluate.mockResolvedValue(evaluation(30));
  await optimizeMatch("cv1");
  expect(mocks.refine).not.toHaveBeenCalled();
  expect(mocks.messages.mock.calls[0][0].data[1].text).toContain(
    "CV was left unchanged",
  );
  expect(mocks.evaluate).toHaveBeenCalledTimes(2);
});
it("stops when all reviewed checks are supported", async () => {
  mocks.evaluate.mockResolvedValue(evaluation(100, "supported"));
  await optimizeMatch("cv1");
  expect(mocks.generate).toHaveBeenCalledTimes(1);
  expect(mocks.refine.mock.calls[0][4].assessment.score).toBe(100);
});
it("can preserve a score while bringing an oversized source within two pages", async () => {
  mocks.measure.mockResolvedValue({
    pages: 3,
    pageFill: [0.98, 0.98, 0.4],
    full: false,
  });
  mocks.evaluate.mockResolvedValue(evaluation(40));
  await optimizeMatch("cv1");
  expect(mocks.refine).toHaveBeenCalledTimes(1);
  expect(mocks.refine.mock.calls[0][4].assessment.score).toBe(40);
});

it("allows a same-score revision to fill a sparse second page, even above 90", async () => {
  mocks.cv.mockResolvedValue({
    ...cv,
    assessments: [{ ...evaluation(92), stale: false }],
  });
  mocks.measure.mockResolvedValue({
    pages: 2,
    pageFill: [0.98, 0.3],
    full: false,
  });
  mocks.evaluate.mockResolvedValue(evaluation(92));
  await optimizeMatch("cv1");
  expect(mocks.generate).toHaveBeenCalledTimes(2);
  expect(mocks.refine).toHaveBeenCalledOnce();
  expect(mocks.refine.mock.calls[0][4].assessment.score).toBe(92);
});

it("keeps working above 90 while checks remain unmet, and includes targeted questions", async () => {
  mocks.cv.mockResolvedValue({
    ...cv,
    assessments: [{ ...evaluation(92), stale: false }],
  });
  mocks.evaluate.mockResolvedValue(evaluation(92));
  await optimizeMatch("cv1");
  expect(mocks.generate).toHaveBeenCalledTimes(2);
  expect(mocks.messages.mock.calls[0][0].data[1].text).toContain(
    "Which React applications did you personally build?",
  );
  expect(mocks.generate.mock.calls[0][3].evidencePlan).toEqual(
    await mocks.plan.mock.results[0].value,
  );
});
it("accepts a newly filled check even when rounding leaves the score unchanged", async () => {
  mocks.evaluate.mockResolvedValue(evaluation(40, "supported"));
  await optimizeMatch("cv1");
  expect(mocks.refine).toHaveBeenCalledOnce();
  expect(mocks.refine.mock.calls[0][4].reply).toContain("1/1 checks supported");
  expect(mocks.refine.mock.calls[0][4].reply).not.toContain(
    "Which React applications",
  );
});
it("rejects a higher score if it loses an already supported requirement", async () => {
  const reqs = [
    ...requirements,
    { id: "docs", text: "Documentation", group: "preferred" as const },
  ];
  mocks.cv.mockResolvedValue({
    ...cv,
    assessments: [
      {
        score: 70,
        stale: false,
        result: {
          ...evaluation(70).result,
          requirements: reqs,
          items: [
            { requirementId: "react", status: "supported" },
            { requirementId: "docs", status: "absent" },
          ],
        },
      },
    ],
  });
  mocks.app.mockResolvedValue({
    id: "job1",
    postingRevision: 1,
    requirements: reqs,
  });
  mocks.evaluate.mockResolvedValue({
    score: 90,
    result: {
      ...evaluation(90).result,
      requirements: reqs,
      items: [
        { requirementId: "react", status: "partial" },
        { requirementId: "docs", status: "supported" },
      ],
    },
  });
  await optimizeMatch("cv1");
  expect(mocks.refine).not.toHaveBeenCalled();
});
