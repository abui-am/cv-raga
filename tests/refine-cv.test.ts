import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyContent } from "../lib/contracts";
const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  generate: vi.fn(),
  check: vi.fn(),
  evidence: vi.fn(),
  transaction: vi.fn(),
  cv: vi.fn(),
  app: vi.fn(),
  update: vi.fn(),
  revision: vi.fn(),
  suggestions: vi.fn(),
  reject: vi.fn(),
  export: vi.fn(),
  review: vi.fn(),
}));
vi.mock("../lib/server/records", () => ({ getProfile: mocks.profile }));
vi.mock("../lib/server/tailoring", () => ({
  generateTailoring: mocks.generate,
}));
vi.mock("../lib/server/export-quality", () => ({
  checkCvExports: mocks.check,
}));
vi.mock("../lib/server/db", () => ({
  database: () => ({
    evidence: { findMany: mocks.evidence },
    $transaction: mocks.transaction,
  }),
}));
import { refineCv } from "../lib/server/refine-cv";
const content = {
  ...emptyContent,
  name: "Alex Example",
  summary: "Built React apps",
};
const cv = { id: "cv1", currentRevision: 1, revisions: [{ content }] };
const app = { id: "job1", postingRevision: 1 };
beforeEach(() => {
  mocks.profile.mockResolvedValue(null);
  mocks.evidence.mockResolvedValue([]);
  mocks.generate.mockResolvedValue({
    content: { ...content, summary: "Built tested React apps" },
    changes: [
      {
        target: "summary",
        original: content.summary,
        proposed: "Built tested React apps",
        rationale: "Clarify relevant testing",
        sourceIds: ["cv-cv1-1"],
      },
    ],
  });
  mocks.check.mockResolvedValue({ result: { passed: true, pdfPages: 2 } });
  mocks.cv.mockResolvedValue({ currentRevision: 1 });
  mocks.app.mockResolvedValue(app);
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (fn) =>
    fn({
      cv: { findUnique: mocks.cv, updateMany: mocks.update },
      application: { findUnique: mocks.app },
      profile: { findUnique: mocks.profile },
      evidence: { findMany: mocks.evidence },
      cvRevision: { create: mocks.revision },
      suggestion: { createMany: mocks.suggestions, updateMany: mocks.reject },
      exportCheck: { upsert: mocks.export },
      reviewRun: { update: mocks.review },
    }),
  );
});
afterEach(() => vi.resetAllMocks());
it("atomically applies an evidence-backed two-page revision and records the review outcome", async () => {
  await refineCv(
    cv as Parameters<typeof refineCv>[0],
    app as Parameters<typeof refineCv>[1],
    { reviewerFeedback: ["Clarify testing"] },
    "Review improvements",
    { reviewId: "review1" },
  );
  expect(mocks.revision).toHaveBeenCalledWith({
    data: expect.objectContaining({
      cvId: "cv1",
      number: 2,
      reason: "Review improvements",
    }),
  });
  expect(mocks.review).toHaveBeenCalledWith({
    where: { id: "review1" },
    data: { improvement: { status: "applied", cvRevision: 2, error: null } },
  });
  expect(mocks.suggestions.mock.calls[0][0].data[0]).toMatchObject({
    status: "generated",
    baseRevision: 1,
  });
});
it("refuses a failed export before writing a CV revision", async () => {
  mocks.check.mockResolvedValue({ result: { passed: false, pdfPages: 3 } });
  await expect(
    refineCv(
      cv as Parameters<typeof refineCv>[0],
      app as Parameters<typeof refineCv>[1],
      {},
      "Review",
    ),
  ).rejects.toMatchObject({ status: 422 });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("rejects a concurrent CV update and preserves the other window's changes", async () => {
  mocks.cv.mockResolvedValue({ currentRevision: 2 });
  await expect(
    refineCv(
      cv as Parameters<typeof refineCv>[0],
      app as Parameters<typeof refineCv>[1],
      {},
      "Review",
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect(mocks.revision).not.toHaveBeenCalled();
});
