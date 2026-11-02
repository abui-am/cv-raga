import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applicationSchema, emptyContent } from "../lib/contracts";
import { applyProposal } from "../lib/domain";
const mocks = vi.hoisted(() => ({
  ask: vi.fn(),
  measure: vi.fn(),
  fill: vi.fn(),
}));
vi.mock("../lib/server/ai", () => ({ askAi: mocks.ask }));
vi.mock("../lib/server/export-quality", () => ({ measureCv: mocks.measure }));
vi.mock("../lib/server/fill-cv", () => ({ fillTwoPages: mocks.fill }));
import { generateTailoring } from "../lib/server/tailoring";

const content = {
  ...emptyContent,
  name: "Alex Example",
  summary: "Built and tested React applications.",
  skills: ["React", "TypeScript"],
};
const application = applicationSchema.parse({
  id: "job1",
  company: "Example",
  role: "Frontend Engineer",
  workMode: "Remote",
  location: "Ignored city",
  posting: "Develop and test React applications.",
  requirements: [],
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
  { id: "profile-1", title: "Confirmed profile", text: content.summary },
];
const change = {
  target: "summary",
  original: content.summary,
  proposed: "React engineer building tested applications.",
  rationale: "Focus on the role.",
  sourceIds: ["s1"],
};
const priorities = Object.fromEntries(
  ["summary", "skills", "certifications"].map((target) => [
    target,
    { rank: 50, reason: "Relevant to this role" },
  ]),
);
beforeEach(() => {
  mocks.ask.mockResolvedValue({ changes: [change], priorities });
  mocks.measure.mockResolvedValue(2);
  mocks.fill.mockImplementation(async (draft) => ({
    content: draft,
    changes: [],
  }));
});
afterEach(() => vi.resetAllMocks());

it("tailors from verified targets and measures the actual proposed content", async () => {
  const result = await generateTailoring(content, application, sources);
  expect(result.content.summary).toBe(change.proposed);
  expect(content.summary).toBe(change.original);
  expect(mocks.measure).toHaveBeenCalledWith(result.content);
  const payload = mocks.ask.mock.calls[0][3];
  expect(payload.job.location).toBe("");
  expect(payload.constraints.maximumPages).toBe(2);
  expect(payload.posting).toBe(application.posting);
});

it("retains stated languages and their proficiency during tailoring", async () => {
  const languages = [
    "English — B2 (Upper Intermediate)",
    "Indonesian — Native",
  ];
  const result = await generateTailoring(
    { ...content, languages },
    application,
    sources,
  );
  expect(result.content.languages).toEqual(languages);
  expect(mocks.ask.mock.calls[0][3].currentDraft).toContain(languages[0]);
});
it("owns original text and maps constrained source aliases back to confirmed records", async () => {
  mocks.ask.mockResolvedValue({
    changes: [{ ...change, original: "AI formatting differs" }],
    priorities,
  });
  const result = await generateTailoring(content, application, sources);
  expect(result.changes[0].original).toBe(content.summary);
  expect(result.changes[0].sourceIds).toEqual(["profile-1"]);
  expect(mocks.ask.mock.calls[0][3].sources[0].id).toBe("s1");
  const schema = mocks.ask.mock.calls[0][0];
  expect(schema.shape.changes.element.shape.original).toBeUndefined();
  expect(
    schema.shape.changes.element.shape.target.safeParse("invented-target")
      .success,
  ).toBe(false);
  expect(
    schema.shape.priorities.safeParse({
      summary: { rank: 1, reason: "Incomplete" },
    }).success,
  ).toBe(false);
});
it("consolidates repeated target edits without rejecting a valid proposal", async () => {
  mocks.ask.mockResolvedValue({
    changes: [
      change,
      { ...change, proposed: "React engineer writing tested applications." },
    ],
    priorities,
  });
  const result = await generateTailoring(content, application, sources);
  expect(result.changes).toHaveLength(1);
  expect(result.changes[0].proposed).toBe(
    "React engineer writing tested applications.",
  );
});
it("shortens the failed draft using measured feedback and a smaller word budget, preserving the original comparison", async () => {
  mocks.measure.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
  mocks.ask
    .mockResolvedValueOnce({ changes: [change], priorities })
    .mockResolvedValueOnce({
      changes: [
        {
          ...change,
          original: change.proposed,
          proposed: "Engineer building tested React apps.",
        },
      ],
      priorities,
    });
  const result = await generateTailoring(content, application, sources);
  expect(mocks.ask).toHaveBeenCalledTimes(2);
  expect(mocks.ask.mock.calls[1][3].constraints.previousProposalPages).toBe(3);
  expect(mocks.ask.mock.calls[1][3].targets.summary).toBe(change.proposed);
  expect(mocks.ask.mock.calls[1][3].constraints.maximumWords).toBeLessThan(
    mocks.ask.mock.calls[0][3].constraints.maximumWords,
  );
  expect(result.changes[0].original).toBe(content.summary);
  expect(applyProposal(content, result.changes)).toEqual(result.content);
});
it("rejects an essential layout that cannot fit even after local prioritization", async () => {
  mocks.ask.mockResolvedValue({ changes: [], priorities });
  mocks.measure.mockResolvedValue(3);
  await expect(
    generateTailoring(content, application, sources),
  ).rejects.toMatchObject({ status: 422 });
  expect(mocks.ask).toHaveBeenCalledTimes(2);
  expect(mocks.measure.mock.calls.length).toBeGreaterThan(2);
});
it.each([
  { ...change, target: "name" },
  { ...change, sourceIds: ["unconfirmed-source"] },
])(
  "rejects unverifiable changes before rendering: $target / $original",
  async (invalid) => {
    mocks.ask.mockResolvedValue({ changes: [invalid] });
    await expect(
      generateTailoring(content, application, sources),
    ).rejects.toMatchObject({ status: 422 });
    expect(mocks.measure).not.toHaveBeenCalled();
  },
);
it("does not retry provider failures", async () => {
  mocks.ask.mockRejectedValue(new Error("Provider unavailable"));
  await expect(
    generateTailoring(content, application, sources),
  ).rejects.toThrow("Provider unavailable");
  expect(mocks.ask).toHaveBeenCalledTimes(1);
});
it("can remove optional list detail to meet the page budget", async () => {
  mocks.ask.mockResolvedValue({
    priorities,
    changes: [
      {
        ...change,
        target: "skills",
        original: "React\nTypeScript",
        proposed: "",
      },
    ],
  });
  const result = await generateTailoring(content, application, sources);
  expect(result.content.skills).toEqual([]);
});

it("forces an overlong draft to two pages by omitting the lowest-priority project", async () => {
  const full = {
    ...content,
    experience: [
      {
        id: "core",
        role: "Engineer",
        company: "Example",
        period: "2022–Present",
        bullets: ["Built tested React applications"],
      },
    ],
    projects: [
      {
        id: "optional",
        name: "Unrelated project",
        detail: "Older side project",
        bullets: ["Built an unrelated prototype"],
      },
    ],
  };
  mocks.ask.mockResolvedValue({
    changes: [],
    priorities: Object.fromEntries(
      [
        { target: "summary", rank: 2, reason: "Relevant introduction" },
        { target: "skills", rank: 1, reason: "Required React experience" },
        { target: "certifications", rank: 50, reason: "No certifications" },
        {
          target: "experience:core",
          rank: 1,
          reason: "Directly supports the job",
        },
        {
          target: "projects:optional",
          rank: 100,
          reason: "Unrelated to the job requirements",
        },
      ].map(({ target, ...priority }) => [target, priority]),
    ),
  });
  mocks.measure.mockImplementation(async (draft) =>
    draft.projects.length ? 3 : 2,
  );
  const result = await generateTailoring(full, application, sources);
  expect(result.content.projects).toEqual([]);
  expect(result.content.experience).toEqual(full.experience);
  expect(full.projects).toHaveLength(1);
  expect(applyProposal(full, result.changes)).toEqual(result.content);
  expect(mocks.ask).toHaveBeenCalledTimes(2);
});

it("rejects incomplete or unknown content priorities before layout fitting", async () => {
  mocks.ask.mockResolvedValue({
    changes: [],
    priorities: { invented: { rank: 1, reason: "Invalid" } },
  });
  await expect(
    generateTailoring(content, application, sources),
  ).rejects.toMatchObject({ status: 422 });
  expect(mocks.measure).not.toHaveBeenCalled();
});

it("includes page-filling summary and nice-to-have edits in the reviewable comparison", async () => {
  const summary = `${change.proposed} Documents integration behavior and collaborates with engineers.`;
  mocks.fill.mockImplementation(async (draft) => ({
    content: { ...draft, summary },
    changes: [
      {
        ...change,
        original: draft.summary,
        proposed: summary,
        sourceIds: ["profile-1"],
      },
    ],
  }));
  const result = await generateTailoring(content, application, sources);
  expect(mocks.fill).toHaveBeenCalledOnce();
  expect(applyProposal(content, result.changes)).toEqual(result.content);
  expect(result.changes[0].original).toBe(content.summary);
  expect(result.content.summary).toBe(summary);
  expect(mocks.ask.mock.calls[0][2]).toContain("EXACTLY TWO FULL");
  expect(mocks.ask.mock.calls[0][2]).toContain("nice-to-have");
});

it("restores the confirmed publication and full URL even when AI tries to omit it", async () => {
  const publication =
    "IEEE: Hybrid fine-tuning + RAG — https://ieeexplore.ieee.org/document/11715165";
  const confirmed = [
    {
      ...sources[0],
      text: `${sources[0].text}\n${publication}`,
      publications: [publication],
    },
  ];
  mocks.ask.mockResolvedValue({
    changes: [{ ...change, target: "certifications", proposed: "" }],
    priorities,
  });
  const result = await generateTailoring(content, application, confirmed);
  expect(result.content.certifications).toEqual([publication]);
  expect(applyProposal(content, result.changes)).toEqual(result.content);
  expect(
    result.changes.find((c) => c.target === "certifications")?.sourceIds,
  ).toContain("profile-1");
  expect(mocks.ask.mock.calls[0][3].protectedPublications).toEqual([
    publication,
  ]);
});

it("removes optional awards during local fitting while protecting the publication", async () => {
  const publication =
    "IEEE: Published paper — https://ieeexplore.ieee.org/document/11715165";
  const original = {
    ...content,
    certifications: [publication, "Optional award"],
  };
  mocks.ask.mockResolvedValue({
    changes: [],
    priorities: {
      ...priorities,
      certifications: { rank: 100, reason: "Optional awards" },
    },
  });
  mocks.measure.mockImplementation(async (draft) =>
    draft.certifications.includes("Optional award") ? 3 : 2,
  );
  const result = await generateTailoring(original, application, sources);
  expect(result.content.certifications).toEqual([publication]);
});
