import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyContent } from "../lib/contracts";
const mocks = vi.hoisted(() => ({
  ask: vi.fn(),
  getCv: vi.fn(),
  getApplication: vi.fn(),
  sources: vi.fn(),
  refine: vi.fn(),
  transaction: vi.fn(),
  sourceCreate: vi.fn(),
  evidenceCreate: vi.fn(),
  evidenceUpdate: vi.fn(),
  messageCreate: vi.fn(),
  messageUpdate: vi.fn(),
  liveCv: vi.fn(),
  assess: vi.fn(),
  repositories: vi.fn(),
  optimize: vi.fn(),
}));
vi.mock("../lib/server/ai", () => ({ askAi: mocks.ask }));
vi.mock("../lib/server/records", () => ({
  getCv: mocks.getCv,
  getApplication: mocks.getApplication,
}));
vi.mock("../lib/server/refine-cv", () => ({
  refinementSources: mocks.sources,
  refineCv: mocks.refine,
}));
vi.mock("../lib/server/match", () => ({ assessCv: mocks.assess }));
vi.mock("../lib/server/repositories", () => ({
  assistantRepositoryEvidence: mocks.repositories,
}));
vi.mock("../lib/server/optimize-match", () => ({
  optimizeMatch: mocks.optimize,
}));
vi.mock("../lib/server/db", () => ({
  database: () => ({
    $transaction: mocks.transaction,
    cvMessage: { update: mocks.messageUpdate },
  }),
}));
import { cvAssistant } from "../lib/server/cv-assistant";
const statement =
  "I wrote 40 integration tests for the React shipping dashboard.";
const evidence = {
  id: "note1",
  revision: 1,
  title: "Testing",
  text: "Earlier testing note",
};
const request = (
  message: string,
  mode = "refine",
  saveKnowledge = true,
  revision = 1,
) =>
  new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ message, mode, saveKnowledge, revision }),
  });
beforeEach(() => {
  mocks.repositories.mockResolvedValue([]);
  mocks.getCv.mockResolvedValue({
    id: "cv1",
    title: "Role CV",
    currentRevision: 1,
    applicationId: "job1",
    revisions: [{ content: { ...emptyContent, name: "Alex Example" } }],
    messages: [],
    assessments: [
      {
        stale: false,
        score: 72,
        result: {
          requirements: [
            { id: "testing", text: "Integration tests", group: "required" },
          ],
          items: [{ requirementId: "testing", status: "partial" }],
        },
      },
    ],
  });
  mocks.getApplication.mockResolvedValue({
    id: "job1",
    role: "Engineer",
    posting: "Build tested React apps",
    requirements: [],
  });
  mocks.sources.mockResolvedValue({ sources: [], evidence: [evidence] });
  mocks.ask.mockResolvedValue({
    reply: "Which integration tests did you personally implement?",
    readyToRefine: false,
    facts: [],
  });
  mocks.sourceCreate.mockResolvedValue({ id: "source1" });
  mocks.evidenceCreate.mockResolvedValue({ count: 1 });
  mocks.evidenceUpdate.mockResolvedValue({ count: 1 });
  mocks.messageCreate.mockImplementation(async ({ data }) => ({
    ...data,
    id: "message1",
  }));
  mocks.liveCv.mockResolvedValue({ currentRevision: 1 });
  mocks.refine.mockResolvedValue(2);
  mocks.transaction.mockImplementation(async (fn) =>
    fn({
      cv: { findUnique: mocks.liveCv },
      source: { create: mocks.sourceCreate },
      evidence: {
        createMany: mocks.evidenceCreate,
        updateMany: mocks.evidenceUpdate,
      },
      cvMessage: { create: mocks.messageCreate },
    }),
  );
});
afterEach(() => vi.resetAllMocks());
it("asks focused questions using the current match breakdown without modifying the CV", async () => {
  await cvAssistant(request("What evidence do you need?", "question"), "cv1");
  expect(mocks.ask.mock.calls[0][3].match.score).toBe(72);
  expect(mocks.ask.mock.calls[0][3].match.items[0].status).toBe("partial");
  expect(mocks.messageCreate).toHaveBeenCalledTimes(2);
  expect(mocks.refine).not.toHaveBeenCalled();
  expect(mocks.evidenceCreate).not.toHaveBeenCalled();
});

it("prioritizes unmet checks for a general refinement request without requiring score wording", async () => {
  mocks.getApplication.mockResolvedValue({
    id: "job1",
    role: "Engineer",
    posting: "Build tested apps",
    requirements: [
      { id: "testing", text: "Integration tests", group: "required" },
    ],
  });
  mocks.ask.mockResolvedValue({
    reply: "I can use your testing work to fill this check.",
    readyToRefine: true,
    optimizeMatch: false,
    facts: [],
  });
  await cvAssistant(request("Refine my CV using my career record."), "cv1");
  expect(mocks.optimize).toHaveBeenCalledWith("cv1", {
    replyMessageId: "message1",
    userInstruction: "Refine my CV using my career record.",
  });
  expect(mocks.refine).not.toHaveBeenCalled();
});
it("saves exact candidate facts as confirmed Knowledge before refining", async () => {
  mocks.ask.mockResolvedValue({
    reply: "That supplies the missing testing evidence.",
    readyToRefine: true,
    facts: [
      {
        title: "Integration testing",
        quote: statement,
        kind: "Achievement",
        tags: ["testing"],
        existingEvidenceId: null,
      },
    ],
  });
  await cvAssistant(request(statement), "cv1");
  expect(mocks.evidenceCreate.mock.calls[0][0].data[0]).toMatchObject({
    text: statement,
    confirmed: true,
    sourceId: "source1",
  });
  expect(mocks.evidenceCreate.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.refine.mock.invocationCallOrder[0],
  );
  expect(mocks.messageUpdate.mock.calls[0][0].data.text).toContain(
    "revision 2",
  );
});
it("rejects invented Knowledge before writing anything", async () => {
  mocks.ask.mockResolvedValue({
    reply: "Unsupported",
    readyToRefine: true,
    facts: [
      {
        title: "Invented",
        quote: "Managed a bank engineering team of 30",
        existingEvidenceId: null,
      },
    ],
  });
  await expect(cvAssistant(request(statement), "cv1")).rejects.toMatchObject({
    status: 422,
  });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("corrects an existing Knowledge item and preserves the previous note as a source", async () => {
  mocks.ask.mockResolvedValue({
    reply: "Correction captured",
    readyToRefine: false,
    facts: [
      {
        title: "Corrected testing",
        quote: statement,
        kind: "Achievement",
        tags: [],
        existingEvidenceId: "note1",
      },
    ],
  });
  await cvAssistant(request(statement), "cv1");
  expect(mocks.sourceCreate).toHaveBeenCalledWith({
    data: expect.objectContaining({ text: evidence.text }),
  });
  expect(mocks.evidenceUpdate).toHaveBeenCalledWith({
    where: { id: "note1", revision: 1, consolidatedAt: null },
    data: expect.objectContaining({
      text: statement,
      confirmed: true,
      revision: { increment: 1 },
    }),
  });
});
it("respects the user's Knowledge opt-out", async () => {
  mocks.ask.mockResolvedValue({
    reply: "Discussing only",
    readyToRefine: false,
    facts: [
      {
        title: "Testing",
        quote: statement,
        kind: "Achievement",
        tags: [],
        existingEvidenceId: null,
      },
    ],
  });
  await cvAssistant(request(statement, "question", false), "cv1");
  expect(mocks.evidenceCreate).not.toHaveBeenCalled();
  expect(mocks.evidenceUpdate).not.toHaveBeenCalled();
});
it("retains the conversation when refinement fails and hides private diagnostics", async () => {
  mocks.ask.mockResolvedValue({
    reply: "I can refine the wording.",
    readyToRefine: true,
    facts: [],
  });
  mocks.refine.mockRejectedValue(new Error("private diagnostic"));
  await cvAssistant(request("Make the summary concise."), "cv1");
  expect(mocks.messageUpdate.mock.calls[0][0].data.text).toContain(
    "CV was not changed",
  );
  expect(mocks.messageUpdate.mock.calls[0][0].data.text).not.toContain(
    "private diagnostic",
  );
});
it("rejects stale conversations before invoking AI", async () => {
  await expect(
    cvAssistant(request(statement, "refine", true, 0), "cv1"),
  ).rejects.toMatchObject({ status: 409 });
  expect(mocks.ask).not.toHaveBeenCalled();
});
it("calculates a missing current match before asking follow-up questions", async () => {
  const cv = await mocks.getCv();
  mocks.getCv.mockResolvedValueOnce({ ...cv, assessments: [] });
  mocks.getApplication.mockResolvedValue({
    id: "job1",
    role: "Engineer",
    requirements: [
      { id: "testing", text: "Integration tests", group: "required" },
    ],
  });
  await cvAssistant(request("What evidence is missing?", "question"), "cv1");
  expect(mocks.assess).toHaveBeenCalledTimes(1);
  expect(mocks.ask.mock.calls[0][3].match.score).toBe(72);
});
it("does not read server repositories in a private workspace", async () => {
  const snippet = {
    repository: "Example",
    file: "src/tests.ts",
    start: 3,
    end: 8,
    text: "test('React workflow', () => runIntegrationTest());",
  };
  mocks.repositories.mockResolvedValue([snippet]);
  await cvAssistant(request("Check my testing repository", "question"), "cv1");
  expect(mocks.repositories).not.toHaveBeenCalled();
  expect(mocks.ask.mock.calls[0][3]).not.toHaveProperty("repositoryEvidence");
  expect(mocks.evidenceCreate).not.toHaveBeenCalled();
});
it("routes a score-improvement conversation to the optimizer rather than an unchecked edit", async () => {
  mocks.ask.mockResolvedValue({
    reply: "I will target the supported match gaps.",
    readyToRefine: true,
    optimizeMatch: true,
    facts: [],
  });
  await cvAssistant(request("Please increase my CVRaga Match score."), "cv1");
  expect(mocks.optimize).toHaveBeenCalledWith("cv1", {
    replyMessageId: "message1",
    userInstruction: "Please increase my CVRaga Match score.",
  });
  expect(mocks.refine).not.toHaveBeenCalled();
});
