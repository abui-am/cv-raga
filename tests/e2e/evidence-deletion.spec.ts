import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";

config({ path: ".env.local", quiet: true });
const url = new URL(process.env.DATABASE_URL!);
url.pathname = "/cvraga_test";
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error("Tests require local PostgreSQL.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url.toString(), max: 2 }),
});
const writeHeaders = { "x-cvraga": "1" };
let sourceId: string;
let confirmed: { id: string; title: string; revision: number };
let draft: { id: string; title: string; revision: number };

test.beforeEach(async () => {
  const source = await db.source.create({
    data: { name: "Deletion test source", text: "Original career facts." },
  });
  sourceId = source.id;
  confirmed = await db.evidence.create({
    data: {
      title: `Confirmed deletion example ${sourceId}`,
      kind: "Achievement",
      text: "Built and documented the deployment workflow.",
      tags: ["testing"],
      confirmed: true,
      sourceId,
    },
  });
  draft = await db.evidence.create({
    data: {
      title: `Draft deletion example ${sourceId}`,
      kind: "Note",
      text: "A career note to review.",
      tags: [],
      sourceId,
    },
  });
});
test.afterEach(async () => {
  await db.evidence.deleteMany({
    where: { OR: [{ sourceId }, { title: `New evidence ${sourceId}` }] },
  });
  await db.source.delete({ where: { id: sourceId } });
});
test.afterAll(async () => {
  await db.$disconnect();
});

test("edits selected evidence in a modal and restores focus after closing", async ({
  page,
}) => {
  await db.evidence.createMany({
    data: Array.from({ length: 14 }, (_, index) => ({
      title: `Navigation example ${index} ${sourceId}`,
      kind: "Note",
      text: "Supporting career context for the evidence library.",
      tags: [],
      sourceId,
    })),
  });
  await page.goto("/knowledge");

  for (const [width, record] of [
    [1280, confirmed],
    [390, draft],
  ] as const) {
    await page.setViewportSize({ width, height: 844 });
    const card = page.locator("section").filter({
      has: page.getByRole("heading", { name: record.title, exact: true }),
    });
    const open = card.getByRole("button", { name: "Review & edit" });
    await open.click();
    const modal = page.getByRole("dialog", { name: "Edit career evidence" });
    await expect(modal).toBeVisible();
    expect(await modal.evaluate((element) => element.matches(":modal"))).toBe(
      true,
    );
    const editor = page.getByRole("heading", { name: "Edit career evidence" });
    await expect(editor).toBeInViewport();
    await expect(editor).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      modal.getByRole("button", { name: "Close", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    const title = modal.getByRole("textbox", { name: "Title", exact: true });
    await expect(title).toBeFocused();
    await page
      .getByRole("button", { name: "Add evidence", exact: true })
      .evaluate((button) => button.focus());
    await expect(title).toBeFocused();
    await expect(
      page.getByRole("textbox", { name: "Title", exact: true }),
    ).toHaveValue(record.title);
    const text = `Updated career evidence at viewport width ${width}.`;
    await page.getByRole("textbox", { name: /^What happened/ }).fill(text);
    await page
      .getByRole("button", { name: "Save evidence", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Saved to your workspace." }),
    ).toBeVisible();
    expect(
      (await db.evidence.findUnique({ where: { id: record.id } }))?.text,
    ).toBe(text);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(open).toBeFocused();
    await expect(open).toBeInViewport();
    await open.click();
    await expect(editor).toBeInViewport();
    await expect(editor).toBeFocused();
    await expect(
      page.getByRole("textbox", { name: /^What happened/ }),
    ).toHaveValue(text);
    await page
      .getByRole("textbox", { name: /^What happened/ })
      .fill("Unsaved evidence wording.");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.keyboard.press("Escape");
    await expect(modal).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /^What happened/ }),
    ).toHaveValue("Unsaved evidence wording.");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(modal).toHaveCount(0);
    await expect(open).toBeFocused();
    await open.click();
    await expect(
      page.getByRole("textbox", { name: /^What happened/ }),
    ).toHaveValue(text);
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(open).toBeFocused();
  }
});

test("confirms evidence deletion, preserves failures and refreshes filtered libraries", async ({
  page,
}) => {
  await page.goto("/knowledge");
  const card = page.locator("section").filter({
    has: page.getByRole("heading", { name: confirmed.title, exact: true }),
  });
  const remove = page.getByRole("button", {
    name: `Delete evidence: ${confirmed.title}`,
    exact: true,
  });
  await expect(card.getByText("Confirmed", { exact: true })).toBeVisible();
  await page.screenshot({
    path: ".data/screenshots/evidence-library-desktop.png",
    fullPage: true,
  });
  const deletions: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "DELETE") deletions.push(request.url());
  });
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain(confirmed.title);
    await dialog.dismiss();
  });
  await remove.click();
  await expect(card).toBeVisible();
  expect(deletions).toHaveLength(0);

  await page.route(`**/api/evidence/${confirmed.id}`, async (route) => {
    if (route.request().method() !== "DELETE") return route.continue();
    await route.fulfill({
      status: 503,
      json: { error: "Deletion unavailable. Try again." },
    });
  });
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Deletion unavailable" }),
  ).toBeVisible();
  await expect(card).toBeVisible();
  expect(
    await db.evidence.findUnique({ where: { id: confirmed.id } }),
  ).not.toBeNull();
  await page.unroute(`**/api/evidence/${confirmed.id}`);

  await page
    .getByRole("textbox", { name: "Search evidence" })
    .fill(confirmed.title);
  await expect(
    page.getByRole("heading", { name: draft.title, exact: true }),
  ).toHaveCount(0);
  await card.getByRole("button", { name: "Review & edit" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit career evidence" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(
    page.getByRole("status").filter({ hasText: "Evidence deleted" }),
  ).toBeVisible();
  await expect(card).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Edit career evidence" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No matching evidence" }),
  ).toBeVisible();
  expect(
    await db.evidence.findUnique({ where: { id: confirmed.id } }),
  ).toBeNull();

  await page.getByRole("textbox", { name: "Search evidence" }).fill("");
  await expect(
    page.getByRole("heading", { name: draft.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: confirmed.title, exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".data/screenshots/evidence-library-mobile.png",
    fullPage: true,
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: `Delete evidence: ${draft.title}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: draft.title, exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your evidence library" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: confirmed.title, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: draft.title, exact: true }),
  ).toHaveCount(0);
  expect(
    await db.source.findUnique({ where: { id: sourceId } }),
  ).not.toBeNull();
});

test("rejects unsafe, invalid and stale deletes without removing evidence", async ({
  request,
}) => {
  const endpoint = `/api/evidence/${confirmed.id}`;
  const forbidden = await request.delete(endpoint, {
    headers: { ...writeHeaders, origin: "https://example.org" },
    data: { revision: confirmed.revision },
  });
  expect(forbidden.status()).toBe(403);
  const missingHeader = await request.delete(endpoint, {
    data: { revision: confirmed.revision },
  });
  expect(missingHeader.status()).toBe(403);
  const invalid = await request.delete(endpoint, {
    headers: writeHeaders,
    data: {},
  });
  expect(invalid.status()).toBe(400);
  await db.evidence.update({
    where: { id: confirmed.id },
    data: { title: "Updated in another window", revision: { increment: 1 } },
  });
  const stale = await request.delete(endpoint, {
    headers: writeHeaders,
    data: { revision: confirmed.revision },
  });
  expect(stale.status()).toBe(409);
  expect(await stale.json()).toEqual({
    error: "This evidence changed. Reload before deleting.",
  });
  expect(
    await db.evidence.findUnique({ where: { id: confirmed.id } }),
  ).toMatchObject({
    title: "Updated in another window",
    revision: confirmed.revision + 1,
  });
  const deleted = await request.delete(endpoint, {
    headers: writeHeaders,
    data: { revision: confirmed.revision + 1 },
  });
  expect(deleted.ok()).toBe(true);
  expect(await deleted.json()).toEqual({ id: confirmed.id });
  expect((await request.get(endpoint)).status()).toBe(404);
  const missing = await request.delete(endpoint, {
    headers: writeHeaders,
    data: { revision: confirmed.revision + 1 },
  });
  expect(missing.status()).toBe(404);
  expect(
    await db.evidence.findUnique({ where: { id: draft.id } }),
  ).not.toBeNull();
});

test("closes the editor when deleting newly saved evidence", async ({
  page,
}) => {
  const title = `New evidence ${sourceId}`;
  await page.goto("/knowledge");
  await page.getByRole("button", { name: "Add evidence", exact: true }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
  await page
    .getByRole("textbox", { name: /^What happened/ })
    .fill("Documented a new career achievement.");
  await page
    .getByRole("button", { name: "Save evidence", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved to your workspace." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Edit career evidence" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Delete evidence: ${title}`, exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Evidence deleted" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Edit career evidence" }),
  ).toHaveCount(0);
});
