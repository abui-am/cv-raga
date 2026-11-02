import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyContent } from "../lib/contracts";
const mocks = vi.hoisted(() => ({
  getApplication: vi.fn(),
  getProfile: vi.fn(),
  getCv: vi.fn(),
  generate: vi.fn(),
  check: vi.fn(),
  findCv: vi.fn(),
  findApp: vi.fn(),
  findProfile: vi.fn(),
  findEvidence: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("../lib/server/records", () => ({
  getApplication: mocks.getApplication,
  getProfile: mocks.getProfile,
  getCv: mocks.getCv,
}));
vi.mock("../lib/server/tailoring", () => ({
  generateTailoring: mocks.generate,
}));
vi.mock("../lib/server/export-quality", () => ({
  checkCvExports: mocks.check,
}));
vi.mock("../lib/server/db", () => ({
  database: () => ({
    cv: { findUnique: mocks.findCv },
    evidence: { findMany: mocks.findEvidence },
    $transaction: mocks.transaction,
  }),
}));
import { createRoleCv } from "../lib/server/role-cv";

const original = {
  ...emptyContent,
  name: "Alex Example",
  summary: "Built tested React apps.",
};
const tailored = {
  ...original,
  summary: "React engineer building tested apps.",
};
const app = {
  id: "job1",
  postingRevision: 1,
  role: "Engineer",
  company: "Example",
};
const profile = { revision: 1, content: original };
beforeEach(() => {
  mocks.getApplication.mockResolvedValue(app);
  mocks.getProfile.mockResolvedValue(profile);
  mocks.getCv.mockImplementation(async (id: string) => ({ id }));
  mocks.findCv.mockResolvedValue(null);
  mocks.findApp.mockResolvedValue(app);
  mocks.findProfile.mockResolvedValue(profile);
  mocks.findEvidence.mockResolvedValue([]);
  mocks.generate.mockResolvedValue({
    content: tailored,
    changes: [
      {
        target: "summary",
        original: original.summary,
        proposed: tailored.summary,
        rationale: "Role relevance",
        sourceIds: ["profile-1"],
      },
    ],
  });
  mocks.check.mockResolvedValue({ result: { passed: true, pdfPages: 2 } });
  mocks.transaction.mockImplementation(async (fn) =>
    fn({
      cv: { findUnique: mocks.findCv, create: mocks.create },
      application: { findUnique: mocks.findApp },
      profile: { findUnique: mocks.findProfile },
      evidence: { findMany: mocks.findEvidence },
    }),
  );
});
afterEach(() => vi.resetAllMocks());

it("saves the source and two-page AI revision together, with generated provenance and export validation", async () => {
  await createRoleCv("job1", null, 1);
  const data = mocks.create.mock.calls[0][0].data;
  expect(data.currentRevision).toBe(2);
  expect(data.revisions.create).toEqual([
    expect.objectContaining({ number: 1, content: original }),
    expect.objectContaining({ number: 2, content: tailored }),
  ]);
  expect(data.suggestions.create[0]).toMatchObject({
    status: "generated",
    baseRevision: 1,
  });
  expect(data.exportChecks.create).toMatchObject({
    cvRevision: 2,
    result: { passed: true, pdfPages: 2 },
  });
  expect(mocks.check).toHaveBeenCalledWith(tailored);
});
it("reuses the completed CV for the same source and role without calling AI again", async () => {
  await createRoleCv("job1", null, 1);
  const savedId = mocks.create.mock.calls[0][0].data.id;
  mocks.findCv.mockResolvedValue({ id: savedId });
  await expect(createRoleCv("job1", null, 1)).resolves.toEqual({ id: savedId });
  expect(mocks.generate).toHaveBeenCalledTimes(1);
  expect(mocks.create).toHaveBeenCalledTimes(1);
});
it("leaves the saved role intact if AI fails", async () => {
  mocks.generate.mockRejectedValue(new Error("AI unavailable"));
  await expect(createRoleCv("job1", null, 1)).rejects.toThrow("AI unavailable");
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("does not save a CV that fails export validation", async () => {
  mocks.check.mockResolvedValue({ result: { passed: false, pdfPages: 3 } });
  await expect(createRoleCv("job1", null, 1)).rejects.toMatchObject({
    status: 422,
  });
  expect(mocks.create).not.toHaveBeenCalled();
});
it("rejects stale job/source revisions after AI completes", async () => {
  mocks.findApp.mockResolvedValue({ ...app, postingRevision: 2 });
  await expect(createRoleCv("job1", null, 1)).rejects.toMatchObject({
    status: 409,
  });
  expect(mocks.create).not.toHaveBeenCalled();
});
it("rejects stale requests before invoking AI", async () => {
  await expect(createRoleCv("job1", null, 2)).rejects.toMatchObject({
    status: 409,
  });
  expect(mocks.generate).not.toHaveBeenCalled();
});
