import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyContent } from "../lib/contracts";
import { reviewerDefinitions } from "../lib/personas";
const mocks = vi.hoisted(() => ({
  ask: vi.fn(),
  getCv: vi.fn(),
  getApplication: vi.fn(),
  createReview: vi.fn(),
  transaction: vi.fn(),
  refine: vi.fn(),
  updateReview: vi.fn(),
}));
vi.mock("../lib/server/ai", () => ({
  askAi: mocks.ask,
  aiModel: () => "test-model",
}));
vi.mock("../lib/server/records", () => ({
  getCv: mocks.getCv,
  getApplication: mocks.getApplication,
}));
vi.mock("../lib/server/db", () => ({
  database: () => ({
    reviewRun: { create: mocks.createReview, update: mocks.updateReview },
    $transaction: mocks.transaction,
  }),
}));
vi.mock("../lib/server/refine-cv", () => ({ refineCv: mocks.refine }));
import { careerDocumentAction } from "../lib/server/career-documents";
const text = "Built tested React applications and documented system behavior.";
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
  mocks.createReview.mockResolvedValue({ id: "review1" });
  mocks.refine.mockResolvedValue(2);
  mocks.getCv.mockResolvedValue({
    id: "cv1",
    currentRevision: 1,
    applicationId: "job1",
    revisions: [
      {
        number: 1,
        content: {
          ...emptyContent,
          name: "Private Name",
          email: "private@example.com",
          summary: text,
        },
      },
    ],
    coverLetters: [],
    reviewRuns: [],
  });
  mocks.getApplication.mockResolvedValue({
    id: "job1",
    postingRevision: 1,
    company: "Example",
    role: "Engineer",
    posting: "Develop and test React applications",
    requirements: [],
    workMode: "Remote",
    location: "",
  });
  mocks.ask.mockImplementation(async (_schema, name: string) => {
    if (name === "cover_letter")
      return {
        content: {
          recipient: "Dear Hiring Manager,",
          subject: "Application",
          paragraphs: [text],
          closing: "Sincerely,",
        },
        evidenceQuotes: ["Fabricated financial results"],
      };
    const persona = name.includes("teamlead")
      ? "TeamLead"
      : name.includes("management")
        ? "Management"
        : "HR";
    return {
      summary: "Advisory evidence review",
      criteria: reviewerDefinitions[persona].criteria.map((c) => ({
        id: c.id,
        status: c.id === "hr_letter" ? "not_assessed" : "evident",
        document: c.id === "hr_letter" ? "none" : "cv",
        quote: c.id === "hr_letter" ? "" : text,
        observation: "Based on supplied document evidence",
        nextStep: "Explain the relevant implementation.",
      })),
    };
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
describe("three independent AI perspectives", () => {
  it("runs three separate prompts, omits personal contact data and stores revision-bound results", async () => {
    const cv = await careerDocumentAction(
      new Request("http://localhost"),
      "cv1",
      "persona-review",
    );
    expect(mocks.ask).toHaveBeenCalledTimes(3);
    for (const call of mocks.ask.mock.calls) {
      expect(call[3].documents.cv).not.toContain("Private Name");
      expect(call[3].documents.cv).not.toContain("private@example.com");
      expect(call[3]).not.toHaveProperty("otherReviews");
      expect(call[3].job.location).toBe("");
    }
    expect(mocks.createReview).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cvRevision: 1,
        postingRevision: 1,
        coverLetterId: null,
        improvement: { status: "ready", cvRevision: null, error: null },
        results: expect.arrayContaining([
          expect.objectContaining({ persona: "HR" }),
          expect.objectContaining({ persona: "TeamLead" }),
          expect.objectContaining({ persona: "Management" }),
        ]),
      }),
    });
    expect(mocks.refine).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateReview).not.toHaveBeenCalled();
    expect(cv.currentRevision).toBe(1);
    expect(cv.revisions).toHaveLength(1);
    expect(cv.revisions[0].content.summary).toBe(text);
  });
  it("applies review improvements only after an explicit apply request", async () => {
    await careerDocumentAction(
      new Request("http://localhost"),
      "cv1",
      "persona-review",
    );
    expect(mocks.refine).not.toHaveBeenCalled();
    const cv = await mocks.getCv();
    cv.reviewRuns = [
      { id: "review1", ...mocks.createReview.mock.calls[0][0].data },
    ];
    await careerDocumentAction(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ reviewId: "review1" }),
      }),
      "cv1",
      "review-apply",
    );
    expect(mocks.refine).toHaveBeenCalledOnce();
    expect(mocks.refine).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cv1" }),
      expect.objectContaining({ id: "job1" }),
      expect.objectContaining({
        reviewerFeedback: expect.arrayContaining([
          expect.objectContaining({ persona: "HR" }),
          expect.objectContaining({ persona: "TeamLead" }),
          expect.objectContaining({ persona: "Management" }),
        ]),
      }),
      expect.stringContaining("review improvements"),
      { reviewId: "review1" },
    );
  });
  it("retains successful perspectives when one fails", async () => {
    mocks.ask.mockRejectedValueOnce(new Error("Provider failure"));
    await careerDocumentAction(
      new Request("http://localhost"),
      "cv1",
      "persona-review",
    );
    const results = mocks.createReview.mock.calls[0][0].data.results;
    expect(results.filter((r: { result: unknown }) => r.result)).toHaveLength(
      2,
    );
    expect(results[0].error).not.toContain("Provider failure");
    expect(mocks.refine).not.toHaveBeenCalled();
  });
  it("preserves saved documents when all reviewers fail", async () => {
    mocks.ask.mockRejectedValue(new Error("Invalid output"));
    await expect(
      careerDocumentAction(
        new Request("http://localhost"),
        "cv1",
        "persona-review",
      ),
    ).rejects.toMatchObject({ status: 502 });
    expect(mocks.createReview).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects unsupported cover letter claims before storing a draft", async () => {
    await expect(
      careerDocumentAction(
        new Request("http://localhost"),
        "cv1",
        "letter-generate",
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("keeps all completed reviews when explicitly applying improvements fails", async () => {
    await careerDocumentAction(
      new Request("http://localhost"),
      "cv1",
      "persona-review",
    );
    const cv = await mocks.getCv();
    cv.reviewRuns = [
      { id: "review1", ...mocks.createReview.mock.calls[0][0].data },
    ];
    mocks.refine.mockRejectedValueOnce(
      new Error("Private provider diagnostics"),
    );
    await careerDocumentAction(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ reviewId: "review1" }),
      }),
      "cv1",
      "review-apply",
    );
    expect(mocks.createReview).toHaveBeenCalledTimes(1);
    expect(mocks.updateReview).toHaveBeenCalledWith({
      where: { id: "review1" },
      data: {
        improvement: expect.objectContaining({
          status: "failed",
          cvRevision: null,
          error: expect.not.stringContaining("Private provider diagnostics"),
        }),
      },
    });
  });
});
