import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applicationSchema, emptyContent } from "../lib/contracts";
import { applyProposal } from "../lib/domain";
const mocks = vi.hoisted(() => ({ ask: vi.fn(), measure: vi.fn() }));
vi.mock("../lib/server/ai", () => ({ askAi: mocks.ask }));
vi.mock("../lib/server/export-quality", () => ({
  measureCvLayout: mocks.measure,
}));
import { fillTwoPages } from "../lib/server/fill-cv";
const content = {
  ...emptyContent,
  name: "Alex Example",
  summary: "React engineer.",
  experience: [
    {
      id: "role1",
      company: "Example",
      role: "Engineer",
      period: "2022–2026",
      bullets: ["Built React applications."],
    },
  ],
};
const app = applicationSchema.parse({
  id: "job1",
  company: "Example",
  role: "Engineer",
  posting: "Build and test React applications.",
  requirements: [],
  workMode: "Remote",
  location: "",
  url: "",
  notes: "",
  status: "Saved",
  appliedDate: "",
  nextActionDate: "",
  submittedRevisionId: null,
  revision: 1,
  postingRevision: 1,
  createdAt: "2026-10-26",
  updatedAt: "2026-10-26",
  history: [],
});
const sources = [
  {
    id: "confirmed-1",
    title: "Confirmed career details",
    text: "Built React applications. Wrote integration tests. Documented deployment workflows.",
  },
];
const short = { pages: 2, pageFill: [0.98, 0.5], full: false };
const full = { pages: 2, pageFill: [0.98, 0.96], full: true };
const expansion = {
  target: "experience:role1:bullets",
  text: "Wrote integration tests.",
  rank: 1,
  rationale: "Add verified testing evidence.",
  evidence: [{ sourceId: "s1", quote: "Wrote integration tests." }],
};
beforeEach(() => {
  mocks.measure.mockResolvedValueOnce(short).mockResolvedValue(full);
  mocks.ask.mockResolvedValue({ expansions: [expansion] });
});
afterEach(() => vi.resetAllMocks());

it("adds a cited nice-to-have bullet and stops at two full pages", async () => {
  const result = await fillTwoPages(content, app, sources);
  expect(result.content.experience[0].bullets).toEqual([
    "Built React applications.",
    "Wrote integration tests.",
  ]);
  expect(result.changes[0].sourceIds).toEqual(["confirmed-1"]);
  expect(applyProposal(content, result.changes)).toEqual(result.content);
  expect(content.experience[0].bullets).toHaveLength(1);
  expect(mocks.ask.mock.calls[0][3].constraints.minimumPageFill).toBe(0.94);
});
it("fills a missing professional summary with a supported alternative", async () => {
  mocks.ask.mockResolvedValue({
    expansions: [
      {
        ...expansion,
        target: "summary",
        text: "React engineer who built applications and wrote integration tests.",
      },
    ],
  });
  const result = await fillTwoPages({ ...content, summary: "" }, app, sources);
  expect(result.content.summary).toContain("integration tests");
  expect(result.changes[0].target).toBe("summary");
});
it("skips overflowing and duplicate additions before trying smaller supported facts", async () => {
  mocks.measure
    .mockReset()
    .mockResolvedValueOnce(short)
    .mockResolvedValueOnce({
      pages: 3,
      pageFill: [0.98, 0.98, 0.1],
      full: false,
    })
    .mockResolvedValue(full);
  mocks.ask.mockResolvedValue({
    expansions: [
      { ...expansion, text: "Built React applications." },
      {
        ...expansion,
        text: "Documented deployment workflows.",
        rank: 2,
        evidence: [
          { sourceId: "s1", quote: "Documented deployment workflows." },
        ],
      },
      { ...expansion, rank: 3 },
    ],
  });
  const result = await fillTwoPages(content, app, sources);
  expect(result.content.experience[0].bullets).toEqual([
    "Built React applications.",
    "Wrote integration tests.",
  ]);
  expect(mocks.measure).toHaveBeenCalledTimes(3);
});
it("does not call AI for an already full two-page CV", async () => {
  mocks.measure.mockReset().mockResolvedValue(full);
  expect((await fillTwoPages(content, app, sources)).changes).toEqual([]);
  expect(mocks.ask).not.toHaveBeenCalled();
});
it.each([
  {
    ...expansion,
    evidence: [{ sourceId: "s1", quote: "Unverified Kubernetes achievement" }],
  },
  {
    ...expansion,
    evidence: [{ sourceId: "missing", quote: "Wrote integration tests." }],
  },
  { ...expansion, target: "experience:another-employer:bullets" },
])(
  "does not fill space with unverifiable or misplaced content",
  async (invalid) => {
    mocks.ask.mockResolvedValue({ expansions: [invalid] });
    await expect(fillTwoPages(content, app, sources)).rejects.toMatchObject({
      status: 422,
    });
    expect(mocks.measure).toHaveBeenCalledTimes(1);
  },
);
it("requires two full pages rather than accepting a sparse second page", async () => {
  mocks.measure.mockReset().mockResolvedValue(short);
  await expect(fillTwoPages(content, app, sources)).rejects.toThrow(
    "Add more detail",
  );
  expect(content.summary).toBe("React engineer.");
});
