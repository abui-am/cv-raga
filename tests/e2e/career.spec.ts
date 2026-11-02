import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
import { emptyContent } from "../../lib/contracts";
import { evidenceFromCv } from "../../lib/knowledge-import";

config({ path: ".env.local", quiet: true });
const url = new URL(process.env.DATABASE_URL!);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error("Tests require local PostgreSQL.");
url.pathname = "/cvraga_test";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url.toString(), max: 2 }),
});
const headers = { "x-cvraga": "1" };
test.afterAll(() => db.$disconnect());

test("maintains one career history, linked evidence, and immutable saved CVs", async ({
  page,
  request,
}) => {
  const previous = await db.profile.findUnique({ where: { id: "main" } });
  const content = {
    ...emptyContent,
    name: "Career Example",
    experience: [
      {
        id: "career-role",
        company: "Career Studio",
        role: "Engineer",
        period: "2024–Present",
        bullets: ["Built accessible interfaces."],
      },
    ],
  };
  const profile = await db.profile.upsert({
    where: { id: "main" },
    create: { content },
    update: { content, revision: { increment: 1 } },
  });
  const source = await db.source.create({
    data: {
      name: "Career consolidation fixture",
      text: "Career source retained for provenance.",
    },
  });
  const copy = await db.evidence.create({
    data: { ...evidenceFromCv(content)[0], sourceId: source.id },
  });
  const cv = await db.cv.create({
    data: {
      title: "Career snapshot fixture",
      profileRevision: profile.revision,
      revisions: {
        create: { number: 1, content, reason: "Confirmed career snapshot" },
      },
    },
  });
  let linkedId: string | undefined;
  try {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/career$/);
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link"),
    ).toHaveCount(4);
    await expect(
      page.getByRole("link", { name: "Profile", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Knowledge", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Career history", exact: true })
      .click();
    await page.getByLabel("Job title", { exact: true }).fill("Senior Engineer");
    await page
      .getByRole("button", { name: "Personal details", exact: true })
      .click();
    const languages = [
      "English — B2 (Upper Intermediate)",
      "Indonesian — Native",
    ];
    await page
      .getByLabel("Languages & proficiency", { exact: true })
      .fill(languages.join("\n"));
    await page
      .getByRole("button", { name: "Career history", exact: true })
      .click();
    await expect(page.getByLabel("Job title", { exact: true })).toHaveValue(
      "Senior Engineer",
    );
    await page
      .getByRole("button", { name: "Confirm & save career", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Saved to your workspace." }),
    ).toBeVisible();
    expect(
      (await (await request.get("/api/profile")).json()).content.languages,
    ).toEqual(languages);
    await page
      .getByRole("button", { name: "Personal details", exact: true })
      .click();
    await expect(
      page.getByLabel("Languages & proficiency", { exact: true }),
    ).toHaveValue(languages.join("\n"));
    await page
      .getByRole("button", { name: "Career history", exact: true })
      .click();
    const consolidated = await db.evidence.findUniqueOrThrow({
      where: { id: copy.id },
    });
    expect(consolidated.consolidatedAt).not.toBeNull();
    expect((await request.get(`/api/evidence/${copy.id}`)).status()).toBe(404);
    expect(
      await db.source.findUnique({ where: { id: source.id } }),
    ).not.toBeNull();
    await page
      .getByRole("button", { name: "Add supporting evidence", exact: true })
      .click();
    await expect(
      page.getByLabel("Related career entry", { exact: true }),
    ).toHaveValue("experience:career-role");
    await page
      .getByLabel("Title", { exact: true })
      .fill("Career supporting metric");
    await page
      .getByLabel(/^What happened/)
      .fill(
        "Reduced accessibility support requests by 15% after improving the forms.",
      );
    await page
      .getByRole("button", { name: "Personal details", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Supporting evidence", exact: true })
      .click();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Career supporting metric",
    );
    await page.getByRole("checkbox", { name: /I confirm/ }).check();
    await page
      .getByRole("button", { name: "Save evidence", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Saved to your workspace." }),
    ).toBeVisible();
    const linked = await db.evidence.findFirstOrThrow({
      where: { title: "Career supporting metric" },
    });
    linkedId = linked.id;
    expect(linked.careerEntryId).toBe("experience:career-role");
    await expect(
      page.getByText("Senior Engineer — Career Studio", { exact: true }).last(),
    ).toBeVisible();
    const duplicate = await request.post("/api/evidence", {
      headers,
      data: {
        title: "Duplicate",
        kind: "Note",
        text: content.experience[0].bullets[0],
        tags: [],
        confirmed: true,
        sourceId: null,
      },
    });
    expect(duplicate.status()).toBe(400);
    const dangling = await request.post("/api/evidence", {
      headers,
      data: {
        title: "Dangling",
        kind: "Note",
        text: "Extra career detail",
        tags: [],
        confirmed: true,
        sourceId: null,
        careerEntryId: "experience:missing",
      },
    });
    expect(dangling.status()).toBe(409);
    const stale = await request.post("/api/profile", {
      headers,
      data: { content, revision: profile.revision },
    });
    expect(stale.status()).toBe(409);
    await page
      .getByRole("button", { name: "Career history", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remove role 1", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm & save career", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Saved to your workspace." }),
    ).toBeVisible();
    expect(
      (await db.evidence.findUniqueOrThrow({ where: { id: linked.id } }))
        .careerEntryId,
    ).toBeNull();
    const snapshot = await db.cv.findUniqueOrThrow({
      where: { id: cv.id },
      include: { revisions: true },
    });
    expect(snapshot.currentRevision).toBe(1);
    expect(snapshot.revisions[0].content).toEqual(content);
    await page.goto("/knowledge");
    await expect(page).toHaveURL(/\/career\?section=evidence$/);
    await expect(
      page.getByRole("heading", { name: copy.title, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: linked.title, exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".data/screenshots/career-evidence-mobile.png",
      fullPage: true,
    });
  } finally {
    await db.cv.delete({ where: { id: cv.id } });
    await db.evidence.deleteMany({
      where: { id: { in: [copy.id, ...(linkedId ? [linkedId] : [])] } },
    });
    await db.source.delete({ where: { id: source.id } });
    if (previous)
      await db.profile.update({
        where: { id: "main" },
        data: { content: previous.content!, revision: previous.revision },
      });
    else await db.profile.delete({ where: { id: "main" } });
  }
});
