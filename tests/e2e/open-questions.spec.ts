import { expect, test } from "@playwright/test";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";

config({ path: ".env.local", quiet: true });
const url = new URL(process.env.DATABASE_URL!);
url.pathname = "/cvraga_test";
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.pathname !== "/cvraga_test"
)
  throw new Error("Refusing to use a non-test database");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url.toString(), max: 2 }),
});
const closedQuestion = "Open question fixture that is already closed";
const savedQuestion = "Open question fixture that gets an answer";
const answer = "A confirmed fixture answer for the open question.";

test.beforeEach(async () => {
  await db.evidence.deleteMany({
    where: { title: { in: [closedQuestion, savedQuestion] } },
  });
  await db.openQuestion.deleteMany({
    where: { question: { in: [closedQuestion, savedQuestion] } },
  });
  await db.openQuestion.createMany({
    data: [{ question: closedQuestion }, { question: savedQuestion }],
  });
});
test.afterAll(async () => {
  await db.evidence.deleteMany({
    where: { title: { in: [closedQuestion, savedQuestion] } },
  });
  await db.openQuestion.deleteMany({
    where: { question: { in: [closedQuestion, savedQuestion] } },
  });
  await db.$disconnect();
});

test("answers one open question and reports a question that is no longer open", async ({
  page,
}) => {
  await page.goto("/career?section=evidence");
  const closed = page.getByRole("button", {
    name: `Answer: ${closedQuestion}`,
  });
  await closed.click();
  await expect(page.getByLabel("Your answer")).toBeFocused();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(closed).toBeFocused();

  await closed.click();
  await page.getByLabel("Your answer").fill("Temporary answer");
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toBe("Discard unsaved evidence changes?");
    dialog.accept();
  });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(closed).toBeFocused();

  await closed.click();
  await db.openQuestion.updateMany({
    where: { question: closedQuestion, status: "unsure" },
    data: { status: "answered" },
  });
  await page
    .getByLabel("Your answer")
    .fill("This answer should not be stored.");
  await page.getByRole("button", { name: "Save answer" }).click();
  await expect(
    page.getByText("That question is no longer open."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Answer: ${closedQuestion}` }),
  ).toHaveCount(0);
  expect(
    await db.evidence.count({
      where: { text: "This answer should not be stored." },
    }),
  ).toBe(0);

  const saved = page.getByRole("button", {
    name: `Answer: ${savedQuestion}`,
  });
  const questions = page.getByRole("region", {
    name: "Questions without evidence",
  });
  await saved.click();
  await expect(questions.getByLabel("Type", { exact: true })).toHaveValue(
    "Note",
  );
  await expect(
    questions.getByText("Saving confirms this answer as career evidence."),
  ).toBeVisible();
  await questions.getByRole("button", { name: "Save answer" }).click();
  await expect(questions.getByText("Add the evidence")).toBeVisible();
  await questions.getByLabel("Your answer").fill(answer);
  await questions.getByRole("button", { name: "Save answer" }).click();
  await expect(
    page.getByText(
      "Answer saved. It is confirmed career evidence. Career search is not configured, so this answer is not searchable yet.",
    ),
  ).toBeVisible();
  await expect(saved).toHaveCount(0);
  const card = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { level: 3, name: savedQuestion }),
    })
    .last();
  await expect(card.getByText("Note", { exact: true })).toBeVisible();
  await expect(card.getByText("Confirmed", { exact: true })).toBeVisible();
  await expect(card.getByText(answer)).toBeVisible();
  await expect(card.getByText("General career evidence")).toBeVisible();

  const stored = await db.evidence.findFirst({
    where: { title: savedQuestion },
  });
  const question = await db.openQuestion.findFirst({
    where: { question: savedQuestion },
  });
  expect(stored).toMatchObject({
    kind: "Note",
    text: answer,
    confirmed: true,
    tags: [],
    sourceId: null,
    careerEntryId: null,
  });
  expect(question).toMatchObject({
    status: "answered",
    evidenceId: stored?.id,
  });
});
