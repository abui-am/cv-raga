import { test, expect, type APIRequestContext } from "@playwright/test";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
import { readFile, mkdir, unlink, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { PDFParse } from "pdf-parse";
import { getPath } from "pdf-parse/worker";
import mammoth from "mammoth";
import { contentText } from "../../lib/domain";
import { RUBRIC, type CvContent } from "../../lib/contracts";

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
const writeHeaders = { "x-cvraga": "1" };
let applicationId: string;
let cvId: string;

async function getJson(request: APIRequestContext, path: string) {
  const response = await request.get(`/api/${path}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await db.repository.deleteMany();
  const fixture = resolve(".data/test-repositories/repository-fixture");
  await rm(fixture, { recursive: true, force: true });
  await mkdir(fixture, { recursive: true });
  await promisify(execFile)("git", ["init", fixture]);
  await writeFile(
    `${fixture}/README.md`,
    "# Example repository\nReact testing workflows with integration tests and accessible user interfaces.\n",
  );
  const sources = await db.source.findMany();
  await db.application.updateMany({ data: { submittedRevisionId: null } });
  await db.assessment.deleteMany();
  await db.suggestion.deleteMany();
  await db.reviewRun.deleteMany();
  await db.coverLetter.deleteMany();
  await db.exportCheck.deleteMany();
  await db.cvRevision.deleteMany();
  await db.cv.deleteMany();
  await db.statusEvent.deleteMany();
  await db.application.deleteMany();
  await db.evidence.deleteMany();
  await db.source.deleteMany();
  await db.profile.deleteMany();
  for (const source of sources)
    if (source.storagePath) await unlink(source.storagePath).catch(() => {});
});
test.afterAll(async () => {
  await db.$disconnect();
});

test("imports a document, confirms a profile, stores evidence and creates an application CV", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/career$/);
  await page
    .getByLabel("Upload career document")
    .filter({ visible: true })
    .setInputFiles({
      name: "career.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "Alex Example\nalex@example.com\nFrontend engineer with React and TypeScript experience.",
      ),
    });
  await expect(page.getByRole("heading", { name: "career.txt" })).toBeVisible();
  await page.reload();
  await page.getByText(/^Previously imported documents/).click();
  await page
    .getByLabel("Saved document", { exact: true })
    .filter({ visible: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "Use saved document", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "career.txt" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review career draft" }),
  ).toBeDisabled();
  await page
    .getByRole("main")
    .getByLabel(/^Full name/)
    .filter({ visible: true })
    .fill("Alex Example");
  await page
    .getByRole("main")
    .getByLabel(/^Professional headline/)
    .filter({ visible: true })
    .fill("Frontend Engineer");
  await page
    .getByRole("main")
    .getByLabel(/^Email/)
    .filter({ visible: true })
    .fill("alex@example.com");
  await page
    .getByRole("main")
    .getByLabel(/^Phone/)
    .filter({ visible: true })
    .fill("+62 812 0000 0000");
  await page
    .getByRole("main")
    .getByLabel(/^Location/)
    .filter({ visible: true })
    .fill("Jakarta, Indonesia");
  await page
    .getByRole("button", { name: "Career history", exact: true })
    .click();
  await page
    .getByLabel(/^Professional summary/)
    .filter({ visible: true })
    .fill(
      "Frontend engineer developing React and TypeScript applications with unit tests and clear documentation.",
    );
  await page
    .getByLabel(/^Technical skills/)
    .filter({ visible: true })
    .fill("TypeScript\nReact\nNext.js\nDocker\nGit");
  await page.getByRole("button", { name: "Add role", exact: true }).click();
  await page
    .getByRole("main")
    .getByLabel("Job title", { exact: true })
    .filter({ visible: true })
    .fill("Frontend Engineer");
  await page
    .getByRole("main")
    .getByLabel("Company", { exact: true })
    .filter({ visible: true })
    .fill("Example Studio");
  await page
    .getByRole("main")
    .getByLabel("Dates", { exact: true })
    .filter({ visible: true })
    .fill("Apr 2022 – Present");
  await page
    .getByLabel(/^Responsibilities & achievements/)
    .filter({ visible: true })
    .fill(
      "Built React and Next.js applications using TypeScript.\nWrote unit tests and documented frontend architecture.",
    );
  await page.getByRole("button", { name: "Confirm & save career" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved to your workspace." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My career", exact: true }).click();
  await page
    .getByRole("button", { name: "Supporting evidence", exact: true })
    .click();
  await page.getByRole("button", { name: "Add evidence", exact: true }).click();
  await page
    .getByRole("main")
    .getByLabel("Title", { exact: true })
    .filter({ visible: true })
    .fill("Improved CI feedback");
  await page
    .getByLabel(/^What happened/)
    .filter({ visible: true })
    .fill(
      "Configured test runs for pull requests and collaborated with developers to fix recurring failures.",
    );
  await page
    .getByRole("main")
    .getByLabel(/^Tags/)
    .filter({ visible: true })
    .fill("testing,collaboration");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save evidence" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved to your workspace." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Applications", exact: true }).click();
  await page
    .getByRole("button", { name: "Add opportunity", exact: true })
    .click();
  await page.getByRole("button", { name: "Use banking example" }).click();
  await page
    .getByRole("main")
    .getByLabel("Company", { exact: true })
    .filter({ visible: true })
    .fill("Test Bank");
  await page
    .getByRole("checkbox", { name: "Automatically tailor a CV" })
    .uncheck();
  await page.getByRole("button", { name: "Save opportunity" }).click();
  await expect(page).toHaveURL(/\/applications\/[^/]+$/);
  applicationId = page.url().split("/").at(-1)!;
  await page.getByRole("button", { name: "Create CV", exact: true }).click();
  await expect(page).toHaveURL(/\/cvs\/[^/]+$/);
  cvId = page.url().split("/").at(-1)!;
  await expect(page.getByRole("article", { name: "CV preview" })).toContainText(
    "Alex Example",
  );
  await expect(
    page.getByRole("figure", { name: "PDF page 1 of 1" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole("figure", { name: "PDF page 1 of 1" })
        .locator("canvas")
        .evaluate((canvas) => (canvas as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Tailor for this role" }),
  ).toBeDisabled();
  await mkdir(".data/screenshots", { recursive: true });
  await page.screenshot({
    path: ".data/screenshots/cv-desktop.png",
    fullPage: true,
  });
});

test("preserves dirty form input through refetch and rejects conflicting CV edits", async ({
  page,
  request,
}) => {
  await page.goto(`/cvs/${cvId}`);
  await page.getByRole("button", { name: "Edit content", exact: true }).click();
  await page
    .getByLabel(/^Professional summary/)
    .filter({ visible: true })
    .fill(
      "Frontend engineer building tested React and TypeScript applications with clear documentation.",
    );
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  await expect(
    page
      .getByRole("main")
      .getByLabel(/^Professional summary/)
      .filter({ visible: true }),
  ).toHaveValue(
    "Frontend engineer building tested React and TypeScript applications with clear documentation.",
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved to your workspace." }),
  ).toBeVisible();
  const cv = await getJson(request, `cvs/${cvId}`);
  expect(cv.currentRevision).toBe(2);
  expect(cv.revisions[1].content.summary).toContain("developing React");
  const conflict = await request.patch(`/api/cvs/${cvId}`, {
    headers: writeHeaders,
    data: { revision: 1, content: cv.revisions[1].content },
  });
  expect(conflict.status()).toBe(409);
  const profile = await getJson(request, "profile");
  expect(profile.content.summary).toContain("developing React");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("article", { name: "CV preview" })).toContainText(
    "building tested React",
  );
});

test("exports readable PDF/DOCX and imports both formats without AI", async ({
  page,
  request,
}) => {
  await page.goto(`/cvs/${cvId}`);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/-v2\.pdf$/);
  const pdf = await readFile((await download.path())!);
  PDFParse.setWorker(getPath());
  const parser = new PDFParse({ data: pdf });
  try {
    const result = await parser.getText();
    expect(result.text).toContain("Alex Example");
    expect(result.text).toContain("Example Studio");
    expect(result.text.indexOf("Alex Example")).toBeLessThan(
      result.text.indexOf("Professional summary".toUpperCase()),
    );
  } finally {
    await parser.destroy();
  }
  const wordResponse = await request.get(
    `/api/cvs/${cvId}/export?format=docx&revision=2`,
  );
  expect(wordResponse.ok()).toBeTruthy();
  const word = await wordResponse.body();
  const wordText = (await mammoth.extractRawText({ buffer: word })).value;
  expect(wordText).toContain("Alex Example");
  expect(wordText).toContain("building tested React");
  expect(wordText).toContain("Example Studio");
  for (const [name, mimeType, buffer] of [
    ["roundtrip.pdf", "application/pdf", pdf],
    [
      "roundtrip.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      word,
    ],
  ] as const) {
    const imported = await request.post("/api/sources", {
      headers: writeHeaders,
      multipart: { file: { name, mimeType, buffer } },
    });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    const source = await imported.json();
    expect(source.text).toContain("Alex Example");
  }
  const invalid = await request.post("/api/sources", {
    headers: writeHeaders,
    multipart: {
      file: {
        name: "fake.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("Not a PDF"),
      },
    },
  });
  expect(invalid.status()).toBe(422);
});

test("reviews changes, retains assessment history and refreshes status filters", async ({
  page,
  request,
}) => {
  const cv = await getJson(request, `cvs/${cvId}`);
  const profile = await getJson(request, "profile");
  const app = await getJson(request, `applications/${applicationId}`);
  const suggestion = await db.suggestion.create({
    data: {
      cvId,
      baseRevision: cv.currentRevision,
      postingRevision: app.postingRevision,
      target: "summary",
      original: cv.revisions[0].content.summary,
      proposed:
        "Frontend engineer building React and TypeScript applications, with unit testing and documentation experience.",
      rationale:
        "Emphasizes the role’s testing and documentation duties using confirmed experience.",
      sources: [
        {
          id: `profile-${profile.revision}`,
          title: "Confirmed profile",
          text: contentText(profile.content as CvContent),
        },
      ],
    },
  });
  await db.assessment.create({
    data: {
      cvId,
      cvRevision: 2,
      applicationId,
      postingRevision: app.postingRevision,
      rubric: RUBRIC,
      score: 75,
      result: {
        model: "fixture",
        requirements: app.requirements,
        items: app.requirements.map((r: { id: string }) => ({
          requirementId: r.id,
          status: "absent",
          cvQuote: "",
          reason: "Fixture only",
        })),
      },
    },
  });
  await page.goto(`/cvs/${cvId}`);
  await page
    .getByRole("button", { name: "Review changes", exact: false })
    .click();
  await expect(page.getByText("Supporting evidence (1)")).toBeVisible();
  await page
    .getByLabel("Proposed wording", { exact: true })
    .filter({ visible: true })
    .fill(
      "Frontend engineer developing tested React and TypeScript applications, with clear documentation.",
    );
  await expect(
    page.getByRole("button", {
      name: "Accept all proposed changes",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Accept wording" }).click();
  await expect(page.getByRole("button", { name: "Undo change" })).toBeVisible();
  await expect(
    page.getByText(
      "Your CV or posting changed. Recalculate to assess the current revisions.",
    ),
  ).toBeVisible();
  const accepted = await getJson(request, `cvs/${cvId}`);
  expect(accepted.currentRevision).toBe(3);
  expect(accepted.assessments[0].stale).toBe(true);
  await page.getByRole("button", { name: "Undo change" }).click();
  await expect(page.getByText("undone", { exact: true })).toBeVisible();
  const undone = await getJson(request, `cvs/${cvId}`);
  expect(undone.currentRevision).toBe(4);
  expect(undone.revisions[0].content.summary).toBe(
    cv.revisions[0].content.summary,
  );
  expect(
    undone.suggestions.find((s: { id: string }) => s.id === suggestion.id)
      .status,
  ).toBe("undone");
  await page.goto(`/applications/${applicationId}`);
  await page
    .getByLabel("Application status", { exact: true })
    .filter({ visible: true })
    .selectOption("Applied");
  await page
    .getByLabel(/^Submitted CV revision/)
    .filter({ visible: true })
    .selectOption(undone.revisions[0].id);
  await page
    .getByRole("button", { name: "Save application", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved to your workspace." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "All opportunities", exact: true })
    .click();
  await page
    .getByRole("main")
    .getByLabel("Filter by status")
    .filter({ visible: true })
    .selectOption("Saved");
  await expect(
    page.getByRole("heading", { name: "No matching opportunities" }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByLabel("Filter by status")
    .filter({ visible: true })
    .selectOption("Applied");
  await expect(
    page.getByRole("heading", { name: "Web Developer", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".data/screenshots/applications-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "My career", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".data/screenshots/profile-mobile.png",
    fullPage: true,
  });
});

test("rejects cross-origin writes and handles missing configuration honestly", async ({
  request,
}) => {
  const settings = await getJson(request, "settings");
  expect(settings.aiConfigured).toBe(false);
  const forbidden = await request.post("/api/profile", {
    headers: { ...writeHeaders, origin: "https://example.org" },
    data: {},
  });
  expect(forbidden.status()).toBe(403);
  const cv = await getJson(request, `cvs/${cvId}`);
  const unavailable = await request.post(`/api/cvs/${cvId}/tailor`, {
    headers: writeHeaders,
    data: {},
  });
  expect(unavailable.status()).toBe(503);
  const unchanged = await getJson(request, `cvs/${cvId}`);
  expect(unchanged.currentRevision).toBe(cv.currentRevision);
});

test("retires duplicate CV imports, handles remote jobs, and confirms a separate cover letter", async ({
  page,
  request,
}) => {
  await page.goto("/knowledge");
  await expect(page).toHaveURL(/\/career\?section=evidence$/);
  await expect(
    page.getByRole("button", { name: "Populate from CV", exact: true }),
  ).toHaveCount(0);
  const retired = await request.post("/api/evidence/populate", {
    headers: writeHeaders,
    data: { type: "cv", id: cvId },
  });
  expect(retired.status()).toBe(410);
  await page.goto(`/applications/${applicationId}`);
  await page
    .getByLabel("Work arrangement", { exact: true })
    .filter({ visible: true })
    .selectOption("On-site");
  await page
    .getByLabel("Job location", { exact: true })
    .filter({ visible: true })
    .fill("Bandung, Indonesia");
  await page
    .getByRole("button", { name: "Save application", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved to your workspace." }),
  ).toBeVisible();
  await page
    .getByLabel("Work arrangement", { exact: true })
    .filter({ visible: true })
    .selectOption("Remote");
  await expect(
    page.getByLabel("Job location", { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save application", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await getJson(request, `applications/${applicationId}`)).workMode,
    )
    .toBe("Remote");
  expect(
    (await getJson(request, `applications/${applicationId}`)).location,
  ).toBe("");
  await page.goto(`/cvs/${cvId}`);
  await page.getByRole("button", { name: "Cover letter", exact: true }).click();
  await page
    .getByLabel("Cover letter", { exact: true })
    .fill(
      "I am applying for the Web Developer role. My experience includes building tested React and TypeScript applications with clear documentation.\n\nI would welcome the opportunity to discuss the role and my relevant work.",
    );
  await page
    .getByRole("button", { name: "Save & confirm letter", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Download letter PDF", exact: true }),
  ).toBeVisible();
  const savedCv = await getJson(request, `cvs/${cvId}`);
  expect(savedCv.coverLetters[0].status).toBe("accepted");
  expect(savedCv.coverLetters[0].stale).toBe(false);
  const letterExport = await request.get(
    `/api/cvs/${cvId}/letter-export?letterId=${savedCv.coverLetters[0].id}&format=pdf`,
  );
  expect(letterExport.ok()).toBe(true);
  await page.getByRole("button", { name: "AI reviewers", exact: true }).click();
  for (const name of ["HR", "Team Lead", "Management"])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run 3 AI reviewers", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Validate export & page count", exact: true })
    .click();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Export reading order and pagination" })
      .getByText("Pass", { exact: true }),
  ).toBeVisible();
  const checked = await getJson(request, `cvs/${cvId}`);
  expect(checked.exportChecks[0].result.passed).toBe(true);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page.getByRole("figure", { name: "PDF page 1 of 1" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".data/screenshots/pdf-pages-desktop.png",
    fullPage: true,
  });
});

test("previews the real page count and blocks CV exports longer than two pages", async ({
  page,
  request,
}) => {
  const current = await getJson(request, `cvs/${cvId}`);
  const createdResponse = await request.post("/api/cvs", {
    headers: writeHeaders,
    data: {
      title: "Pagination regression CV",
      applicationId: null,
      baseCvId: cvId,
    },
  });
  expect(createdResponse.ok()).toBe(true);
  const created = await createdResponse.json();
  const content = {
    ...current.revisions[0].content,
    experience: Array.from({ length: 16 }, (_, i) => ({
      id: `long${i}`,
      role: `Engineer ${i + 1}`,
      company: `Company ${i + 1}`,
      period: "2020–2025",
      bullets: [
        "Full-time (Remote)",
        ...Array.from(
          { length: 3 },
          (_, n) =>
            `Delivered workflow ${i + 1}.${n + 1} using React and TypeScript, collaborating with designers and backend engineers to clarify business requirements, test integration behavior and document accessible application workflows.`,
        ),
      ],
    })),
    education: [
      {
        id: "old",
        qualification: "Earlier degree",
        institution: "Example University",
        period: "2018–2022",
      },
      {
        id: "new",
        qualification: "Recent program",
        institution: "Example Academy",
        period: "2025–2026",
      },
    ],
  };
  const updated = await request.patch(`/api/cvs/${created.id}`, {
    headers: writeHeaders,
    data: { revision: 1, content },
  });
  expect(updated.ok()).toBe(true);
  const preview = await request.get(
    `/api/cvs/${created.id}/preview?revision=2`,
  );
  expect(preview.ok()).toBe(true);
  const parser = new PDFParse({ data: await preview.body() });
  let total: number;
  try {
    const result = await parser.getText();
    total = result.total;
    expect(total).toBeGreaterThan(2);
    expect(result.text).toContain("Full-time · Remote");
    expect(result.text).not.toContain("• Full-time");
  } finally {
    await parser.destroy();
  }
  const blocked = await request.get(
    `/api/cvs/${created.id}/export?format=pdf&revision=2`,
  );
  expect(blocked.status()).toBe(422);
  expect((await blocked.json()).error).toContain("maximum of 2 pages");
  await page.goto(`/cvs/${created.id}`);
  await expect(
    page.getByRole("figure", { name: `PDF page 2 of ${total}` }),
  ).toBeVisible();
  await expect(
    page.getByText(
      `${total} pages · maximum 2 for your CV. Tailor or shorten this CV before downloading.`,
      { exact: true },
    ),
  ).toBeVisible();
  const normalized = await getJson(request, `cvs/${created.id}`);
  expect(normalized.revisions[0].content.education[0].id).toBe("new");
  await page.screenshot({
    path: ".data/screenshots/multiple-pdf-pages.png",
    fullPage: true,
  });
});

test("previews and accepts a complete proposal as one preserved CV revision", async ({
  page,
  request,
}) => {
  const current = await getJson(request, `cvs/${cvId}`);
  const app = await getJson(request, `applications/${applicationId}`);
  const source = {
    id: `cv-${cvId}-${current.currentRevision}`,
    title: "Accepted CV",
    text: contentText(current.revisions[0].content),
  };
  await db.suggestion.createMany({
    data: [
      {
        cvId,
        baseRevision: current.currentRevision,
        postingRevision: app.postingRevision,
        target: "summary",
        original: current.revisions[0].content.summary,
        proposed:
          "Frontend engineer with React, TypeScript, unit testing and documentation experience.",
        rationale: "A concise introduction grounded in the CV.",
        sources: [source],
      },
      {
        cvId,
        baseRevision: current.currentRevision,
        postingRevision: app.postingRevision,
        target: "skills",
        original: current.revisions[0].content.skills.join("\n"),
        proposed: "TypeScript\nReact\nNext.js",
        rationale: "Focus on relevant technical skills.",
        sources: [source],
      },
    ],
  });
  await page.goto(`/cvs/${cvId}`);
  await page.getByRole("button", { name: /^Review changes/ }).click();
  await page
    .getByText("Preview the complete two-page proposal", { exact: true })
    .click();
  await expect(
    page.getByRole("figure", { name: "PDF page 1 of 1" }),
  ).toBeVisible();
  const unchanged = await getJson(request, `cvs/${cvId}`);
  expect(unchanged.currentRevision).toBe(current.currentRevision);
  await page
    .getByRole("button", { name: "Accept all proposed changes", exact: true })
    .click();
  await expect(page.getByRole("article", { name: "CV preview" })).toContainText(
    "Frontend engineer with React, TypeScript",
  );
  const accepted = await getJson(request, `cvs/${cvId}`);
  expect(accepted.currentRevision).toBe(current.currentRevision + 1);
  expect(accepted.revisions[1].content).toEqual(current.revisions[0].content);
  expect(accepted.coverLetters[0].stale).toBe(true);
  expect(accepted.exportChecks[0].stale).toBe(true);
});

test("automatically tailors after saving a role and retries failures without duplicating the opportunity", async ({
  page,
  request,
}) => {
  const fixture = await getJson(request, `cvs/${cvId}`);
  const pdf = await request.get(
    `/api/cvs/${cvId}/preview?revision=${fixture.currentRevision}`,
  );
  const pdfBytes = await pdf.body();
  await page.goto("/applications");
  await page
    .getByRole("button", { name: "Add opportunity", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Automatically tailor a CV" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Use banking example" }).click();
  await page
    .getByRole("main")
    .getByLabel("Company", { exact: true })
    .filter({ visible: true })
    .fill("Automatic Tailoring Example");
  // The test server has no key: exercise the real failed-generation boundary first.
  await page
    .getByRole("button", { name: "Save & tailor CV", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Your opportunity is saved. Retry tailoring" }),
  ).toBeVisible();
  const saved = await db.application.findMany({
    where: { company: "Automatic Tailoring Example" },
  });
  expect(saved).toHaveLength(1);
  expect(await db.cv.count({ where: { applicationId: saved[0].id } })).toBe(0);
  const generated = {
    ...fixture,
    id: "auto-test-cv",
    applicationId: saved[0].id,
    currentRevision: 2,
    revisions: [
      {
        ...fixture.revisions[0],
        id: "auto-generated",
        number: 2,
        reason: "AI tailored automatically for this role · maximum two pages",
      },
      {
        ...fixture.revisions[0],
        id: "auto-original",
        number: 1,
        reason: "Original confirmed profile before automatic tailoring",
      },
    ],
    suggestions: [],
    assessments: [],
    coverLetters: [],
    reviewRuns: [],
    exportChecks: [],
  };
  // Provider success is stubbed in browser tests; server generation and persistence are covered by unit tests.
  let calls = 0;
  await page.route(
    `**/api/applications/${saved[0].id}/create-cv`,
    async (route) => {
      calls++;
      expect(route.request().postDataJSON()).toEqual({
        baseCvId: null,
        postingRevision: saved[0].postingRevision,
      });
      await route.fulfill({ json: generated });
    },
  );
  await page.route("**/api/cvs/auto-test-cv", (route) =>
    route.fulfill({ json: generated }),
  );
  await page.route("**/api/cvs/auto-test-cv/preview?*", (route) =>
    route.fulfill({ body: pdfBytes, contentType: "application/pdf" }),
  );
  await page
    .getByRole("button", { name: "Retry tailoring", exact: true })
    .click();
  await expect(page).toHaveURL(/\/cvs\/auto-test-cv$/);
  await expect(
    page.getByRole("status").filter({ hasText: "AI updated this CV" }),
  ).toBeVisible();
  await expect(
    page.getByRole("figure", { name: "PDF page 1 of 1" }),
  ).toBeVisible();
  expect(calls).toBe(1);
  expect(
    await db.application.count({
      where: { company: "Automatic Tailoring Example" },
    }),
  ).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("status").filter({ hasText: "AI updated this CV" }),
  ).toBeVisible();
  expect(calls).toBe(1);
  const savedApp = await getJson(request, `applications/${saved[0].id}`);
  const renamed = await request.patch(`/api/applications/${saved[0].id}`, {
    headers: writeHeaders,
    data: { ...savedApp, role: "Updated Engineering Role" },
  });
  expect(renamed.ok()).toBe(true);
  expect((await renamed.json()).postingRevision).toBe(
    savedApp.postingRevision + 1,
  );
  const staleGeneration = await request.post(
    `/api/applications/${saved[0].id}/create-cv`,
    {
      headers: writeHeaders,
      data: { baseCvId: null, postingRevision: savedApp.postingRevision },
    },
  );
  expect(staleGeneration.status()).toBe(409);
});

test("lets a general CV choose a role and permits tailoring from a saved editor", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/cvs", {
    headers: writeHeaders,
    data: {
      title: "General CV for role selection",
      applicationId: null,
      baseCvId: cvId,
    },
  });
  expect(response.ok()).toBe(true);
  const general = await response.json();
  await page.route("**/api/settings", (route) =>
    route.fulfill({
      json: { aiConfigured: true, model: "test-model", database: "connected" },
    }),
  );
  await page.goto(`/cvs/${general.id}`);
  const button = page.getByRole("button", {
    name: "Tailor for this role",
    exact: true,
  });
  await expect(button).toBeDisabled();
  await expect(
    page.getByLabel("Job posting for tailoring", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Job posting for tailoring", { exact: true })
    .selectOption(applicationId);
  await expect(button).toBeEnabled();
  await page.getByRole("button", { name: "Edit content", exact: true }).click();
  await expect(button).toBeEnabled();
  await page
    .getByRole("main")
    .getByLabel(/^Professional summary/)
    .filter({ visible: true })
    .fill(
      "React engineer building accessible, tested web applications and documenting system integrations.",
    );
  await expect(button).toBeDisabled();
  await expect(
    page.getByText("Save your content edits before tailoring.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(button).toBeEnabled();
  const fixture = await getJson(request, `cvs/${cvId}`);
  const job = await getJson(request, `applications/${applicationId}`);
  let completeGeneration: () => void = () => {};
  const generationGate = new Promise<void>((resolve) => {
    completeGeneration = resolve;
  });
  await page.route(
    `**/api/applications/${applicationId}/create-cv`,
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        baseCvId: general.id,
        postingRevision: job.postingRevision,
      });
      await generationGate;
      await route.fulfill({ json: fixture });
    },
  );
  await button.click();
  await expect(
    page
      .getByRole("main")
      .getByLabel(/^Professional summary/)
      .filter({ visible: true }),
  ).toBeDisabled();
  completeGeneration();
  await expect(page).toHaveURL(new RegExp(`/cvs/${cvId}$`));
  await page.getByRole("button", { name: "Edit content", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tailor for this role", exact: true }),
  ).toBeEnabled();
});

test("reviews prioritized entry omissions and can accept and undo empty optional content", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/cvs", {
    headers: writeHeaders,
    data: { title: "Prioritized selection CV", applicationId, baseCvId: cvId },
  });
  expect(created.ok()).toBe(true);
  const copy = await created.json();
  const updated = await request.patch(`/api/cvs/${copy.id}`, {
    headers: writeHeaders,
    data: {
      revision: 1,
      content: {
        ...copy.revisions[0].content,
        projects: [
          {
            id: "relevant",
            name: "Relevant React portal",
            detail: "React and testing",
            bullets: ["Built accessible tested React workflows"],
          },
          {
            id: "optional",
            name: "Optional older prototype",
            detail: "Unrelated side project",
            bullets: ["Built an older prototype"],
          },
        ],
      },
    },
  });
  expect(updated.ok()).toBe(true);
  const cv = await updated.json();
  const job = await getJson(request, `applications/${applicationId}`);
  const source = {
    id: `cv-${copy.id}-${cv.currentRevision}`,
    title: "Original CV",
    text: contentText(cv.revisions[0].content),
  };
  await db.suggestion.createMany({
    data: [
      {
        cvId: copy.id,
        baseRevision: cv.currentRevision,
        postingRevision: job.postingRevision,
        target: "projects",
        original: JSON.stringify(cv.revisions[0].content.projects),
        proposed: JSON.stringify([cv.revisions[0].content.projects[0]]),
        rationale: "Omit the low-priority project to fit two pages.",
        sources: [source],
      },
      {
        cvId: copy.id,
        baseRevision: cv.currentRevision,
        postingRevision: job.postingRevision,
        target: "summary",
        original: cv.revisions[0].content.summary,
        proposed: "",
        rationale: "Omit the optional summary to prioritize direct evidence.",
        sources: [source],
      },
    ],
  });
  await page.goto(`/cvs/${copy.id}`);
  await page.getByRole("button", { name: /^Review changes/ }).click();
  const projects = page
    .locator("section")
    .filter({ hasText: "Omit the low-priority project to fit two pages." });
  await expect(
    projects.getByText("Relevant React portal", { exact: false }).first(),
  ).toBeVisible();
  await expect(projects.getByRole("textbox")).toHaveCount(0);
  await projects
    .getByRole("button", { name: "Accept selection", exact: true })
    .click();
  await expect(
    projects.getByRole("button", { name: "Undo change", exact: true }),
  ).toBeVisible();
  const accepted = await getJson(request, `cvs/${copy.id}`);
  expect(
    accepted.revisions[0].content.projects.map((p: { id: string }) => p.id),
  ).toEqual(["relevant"]);
  await projects
    .getByRole("button", { name: "Undo change", exact: true })
    .click();
  await expect(projects.getByText("undone", { exact: true })).toBeVisible();
  const restored = await getJson(request, `cvs/${copy.id}`);
  expect(restored.revisions[0].content.projects).toEqual(
    cv.revisions[0].content.projects,
  );
  const summary = page.locator("section").filter({
    hasText: "Omit the optional summary to prioritize direct evidence.",
  });
  await summary
    .getByRole("button", { name: "Accept selection", exact: true })
    .click();
  await expect(
    summary.getByRole("button", { name: "Undo change", exact: true }),
  ).toBeVisible();
  const omitted = await getJson(request, `cvs/${copy.id}`);
  expect(omitted.revisions[0].content.summary).toBe("");
  await summary
    .getByRole("button", { name: "Undo change", exact: true })
    .click();
  await expect(summary.getByText("undone", { exact: true })).toBeVisible();
  const final = await getJson(request, `cvs/${copy.id}`);
  expect(final.revisions[0].content.summary).toBe(
    cv.revisions[0].content.summary,
  );
});

test("chooses a local repository in a keyboard-accessible picker and disconnects without deleting files", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/knowledge");
  const choose = page.getByRole("button", {
    name: "Choose repository",
    exact: true,
  });
  await choose.click();
  const dialog = page.getByRole("dialog", {
    name: "Choose a local repository",
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(choose).toBeFocused();
  await choose.click();
  await dialog.getByRole("button", { name: /repository-fixture/ }).click();
  await expect(
    dialog.getByText("Git repository found", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".data/screenshots/repository-picker.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Use this repository", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const repos = await getJson(request, "repositories");
  expect(repos).toHaveLength(1);
  expect(repos[0].name).toBe("repository-fixture");
  const repeated = await request.post("/api/repositories", {
    headers: writeHeaders,
    data: { path: repos[0].path },
  });
  expect(repeated.ok()).toBe(true);
  expect((await repeated.json()).id).toBe(repos[0].id);
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByText("Your repositories stay on this computer.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(await getJson(request, "repositories")).toHaveLength(0);
  expect(
    await readFile(
      resolve(".data/test-repositories/repository-fixture/README.md"),
      "utf8",
    ),
  ).toContain("React testing");
});

test("continues an ATS-gap conversation, saves candidate facts to Knowledge and shows the refined revision", async ({
  page,
  request,
}) => {
  await page.route("**/api/settings", (route) =>
    route.fulfill({
      json: { aiConfigured: true, model: "test-model", database: "connected" },
    }),
  );
  const answer =
    "I wrote 40 integration tests for the React shipping dashboard at Example Studio.";
  let turn = 0;
  await page.route(`**/api/cvs/${cvId}/assistant`, async (route) => {
    const body = route.request().postDataJSON();
    expect(body.saveKnowledge).toBe(true);
    expect(body.perspective).toBe("TeamLead");
    const current = await getJson(request, `cvs/${cvId}`);
    let revision = current.currentRevision;
    let response: string;
    if (turn++ === 0) {
      expect(body.mode).toBe("question");
      response =
        "Team Lead: Your testing evidence is partial. Which integration tests did you personally implement, and for which project?";
    } else {
      expect(body.message).toBe(answer);
      const source = await db.source.create({
        data: { name: "Candidate conversation", text: answer },
      });
      await db.evidence.create({
        data: {
          title: "Candidate integration testing",
          kind: "Achievement",
          text: answer,
          confirmed: true,
          tags: ["testing"],
          sourceId: source.id,
        },
      });
      const updated = await request.patch(`/api/cvs/${cvId}`, {
        headers: writeHeaders,
        data: {
          revision,
          content: {
            ...current.revisions[0].content,
            summary: `React engineer with testing experience. ${answer}`,
          },
        },
      });
      expect(updated.ok()).toBe(true);
      revision = (await updated.json()).currentRevision;
      response = `Team Lead: My career updated with your exact testing statement. Saved your refined CV as revision ${revision}. The PDF was verified within two pages.`;
    }
    await db.cvMessage.createMany({
      data: [
        {
          cvId,
          role: "user",
          text: body.message,
          cvRevision: current.currentRevision,
        },
        { cvId, role: "assistant", text: response, cvRevision: revision },
      ],
    });
    await route.fulfill({ json: await getJson(request, `cvs/${cvId}`) });
  });
  await page.goto(`/cvs/${cvId}`);
  await page.getByRole("button", { name: "AI assistant", exact: true }).click();
  await page
    .getByLabel("Perspective", { exact: true })
    .selectOption("TeamLead");
  await page
    .getByLabel("How can AI help?", { exact: true })
    .selectOption("question");
  await page
    .getByLabel("Your message", { exact: true })
    .fill("What evidence do you need for my match gaps?");
  await page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await expect(
    page.getByText("Team Lead: Your testing evidence is partial.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "AI assistant", exact: true }).click();
  await expect(
    page.getByText("Team Lead: Your testing evidence is partial.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Perspective", { exact: true })
    .selectOption("TeamLead");
  await page.getByLabel("Your message", { exact: true }).fill(answer);
  await page.getByRole("button", { name: "Refine CV", exact: true }).click();
  await expect(
    page.getByText("Team Lead: My career updated", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: ".data/screenshots/cv-assistant.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("article", { name: "CV preview" })).toContainText(
    "40 integration tests",
  );
  await page.getByRole("link", { name: "My career", exact: true }).click();
  await page
    .getByRole("button", { name: "Supporting evidence", exact: true })
    .click();
  const evidence = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Candidate integration testing",
      exact: true,
    }),
  });
  await expect(evidence.getByText("Confirmed", { exact: true })).toBeVisible();
  await expect(evidence).toContainText(answer);
});
