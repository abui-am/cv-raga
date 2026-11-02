import { afterEach, expect, it, vi } from "vitest";
import { emptyContent } from "../lib/contracts";
const mocks = vi.hoisted(() => ({ ask: vi.fn() }));
vi.mock("../lib/server/ai", () => ({
  askAi: mocks.ask,
  aiModel: () => "test-model",
}));
vi.mock("../lib/server/db", () => ({ database: () => ({}) }));
import { evaluateMatch } from "../lib/server/match";
const content = {
  ...emptyContent,
  name: "Alex Example",
  summary: "Built tested React applications",
};
const app = {
  requirements: [
    { id: "react", group: "required", text: "React applications" },
  ],
};
afterEach(() => vi.resetAllMocks());
it("credits an optimization claim only when CV and confirmed-source quotes both verify", async () => {
  mocks.ask.mockResolvedValue({
    items: [
      {
        requirementId: "react",
        status: "supported",
        cvQuote: "tested React applications",
        reason: "Directly supported",
        sourceId: "s1",
        sourceQuote: "Built tested React applications",
      },
    ],
  });
  const result = await evaluateMatch(
    content,
    app as Parameters<typeof evaluateMatch>[1],
    [{ id: "source1", text: content.summary }],
  );
  expect(result.score).toBe(100);
});
it("does not boost a candidate with an invented confirmed-source quote", async () => {
  mocks.ask.mockResolvedValue({
    items: [
      {
        requirementId: "react",
        status: "supported",
        cvQuote: "tested React applications",
        reason: "Claim",
        sourceId: "s1",
        sourceQuote: "Invented Java banking experience",
      },
    ],
  });
  const result = await evaluateMatch(
    content,
    app as Parameters<typeof evaluateMatch>[1],
    [{ id: "source1", text: content.summary }],
  );
  expect(result.score).toBe(0);
  expect(result.result.items[0].status).toBe("absent");
});
