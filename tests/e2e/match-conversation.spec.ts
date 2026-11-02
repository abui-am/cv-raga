import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
import { emptyContent } from "../../lib/contracts";

config({ path: ".env.local", quiet: true });
const url = new URL(process.env.DATABASE_URL!);
if (!["127.0.0.1", "localhost"].includes(url.hostname))
  throw Error("Tests require local PostgreSQL.");
url.pathname = "/cvraga_test";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url.toString(), max: 2 }),
});
test.afterAll(() => db.$disconnect());

test("continues a match-gap question directly in the saved AI conversation", async ({
  page,
}) => {
  const question =
    "Have you deployed Kubernetes, and what did you personally handle?";
  const cv = await db.cv.create({
    data: {
      title: "Match conversation fixture",
      profileRevision: 1,
      revisions: {
        create: {
          number: 1,
          reason: "Conversation fixture",
          content: { ...emptyContent, name: "Alex Example" },
        },
      },
      messages: {
        create: {
          role: "assistant",
          cvRevision: 1,
          text: `Match improvement: 80/100 → 88/100.\n\nHelp me fill the remaining checks:\n1. ${question}`,
        },
      },
    },
  });
  try {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") requests.push(request.url());
    });
    await page.goto(`/cvs/${cv.id}`);
    await page
      .getByRole("button", { name: "Edit content", exact: true })
      .click();
    await page
      .getByLabel("Professional summary", { exact: true })
      .fill("Unsaved summary.");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", { name: "Continue with AI", exact: true })
      .click();
    await expect(
      page.getByLabel("Professional summary", { exact: true }),
    ).toHaveValue("Unsaved summary.");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Continue with AI", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "AI assistant", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("heading", { name: "Your CV assistant" }),
    ).toBeInViewport();
    await expect(page.locator("#cv-assistant-panel")).toBeFocused();
    await expect(
      page.locator("#cv-assistant-panel").getByText(question, { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Your message", { exact: true }),
    ).toBeEditable();
    expect(requests).toEqual([]);
  } finally {
    await db.cv.delete({ where: { id: cv.id } });
  }
});
