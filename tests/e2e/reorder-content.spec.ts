import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
import { emptyContent } from "../../lib/contracts";
import { PDFParse } from "pdf-parse";
import { getPath } from "pdf-parse/worker";
import mammoth from "mammoth";

config({ path: ".env.local", quiet: true });
const url = new URL(process.env.DATABASE_URL!);
if (!["127.0.0.1", "localhost"].includes(url.hostname))
  throw Error("Tests require local PostgreSQL.");
url.pathname = "/cvraga_test";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url.toString(), max: 2 }),
});
test.afterAll(() => db.$disconnect());

test("reorders entries and nested bullets without losing edits, persists them and exports the same order", async ({
  page,
  request,
}) => {
  const original = {
    ...emptyContent,
    name: "Ordering Example",
    email: "ordering@example.com",
    summary: "Engineer building tested applications.",
    skills: ["React", "TypeScript", "SQL"],
    experience: [
      {
        id: "alpha",
        role: "Alpha Engineer",
        company: "Alpha Studio",
        period: "2020–2022",
        bullets: ["Built accessible interfaces.", "Documented API behavior."],
      },
      {
        id: "beta",
        role: "Beta Engineer",
        company: "Beta Studio",
        period: "2022–2026",
        bullets: [
          "Investigated session errors.",
          "Wrote deployment documentation.",
        ],
      },
    ],
    projects: [
      {
        id: "project-alpha",
        name: "Alpha Project",
        detail: "Internal tools",
        bullets: ["Built a support workflow."],
      },
      {
        id: "project-beta",
        name: "Beta Project",
        detail: "Public website",
        bullets: ["Documented browser support."],
      },
    ],
    education: [
      {
        id: "edu-old",
        institution: "Old School",
        qualification: "Degree",
        period: "2018–2022",
      },
      {
        id: "edu-new",
        institution: "New School",
        qualification: "Program",
        period: "2025–2026",
      },
    ],
    certifications: [
      "IEEE: Example publication — https://example.com/paper",
      "Example certification",
    ],
  };
  const cv = await db.cv.create({
    data: {
      title: "Content ordering fixture",
      profileRevision: 1,
      revisions: {
        create: { number: 1, reason: "Ordering fixture", content: original },
      },
    },
  });
  try {
    await page.setViewportSize({ width: 1280, height: 2600 });
    await page.goto(`/cvs/${cv.id}`);
    await page
      .getByRole("button", { name: "Edit content", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Section order", exact: true }),
    ).toHaveCount(0);
    const roles = page.getByRole("list", {
      name: "Experience entries",
      exact: true,
    });
    await page
      .getByRole("textbox", { name: "Job title", exact: true })
      .nth(0)
      .fill("Alpha Engineer edited");
    await roles
      .getByRole("button", {
        name: "Drag Beta Engineer at Beta Studio",
        exact: true,
      })
      .dragTo(roles.locator(":scope > li").first(), {
        targetPosition: { x: 30, y: 4 },
      });
    await expect(
      page.getByRole("textbox", { name: "Job title", exact: true }).nth(0),
    ).toHaveValue("Beta Engineer");
    await expect(
      page.getByRole("textbox", { name: "Job title", exact: true }).nth(1),
    ).toHaveValue("Alpha Engineer edited");

    const beta = roles.locator(":scope > li").first();
    await beta.getByText(/^Reorder responsibilities & achievements/).click();
    const bullets = beta.getByRole("list", {
      name: "Responsibilities & achievements order",
    });
    await bullets
      .getByRole("button", {
        name: "Drag Responsibilities & achievements item 2",
        exact: true,
      })
      .dragTo(bullets.locator(":scope > li").first(), {
        targetPosition: { x: 20, y: 2 },
      });
    await expect(
      beta.getByLabel("Responsibilities & achievements", { exact: true }),
    ).toHaveValue(
      "Wrote deployment documentation.\nInvestigated session errors.",
    );
    await expect(
      page.getByRole("textbox", { name: "Job title", exact: true }).nth(0),
    ).toHaveValue("Beta Engineer");

    await page
      .getByRole("button", { name: "Move Beta Project up", exact: true })
      .click();
    await expect(
      page.getByLabel("Project name", { exact: true }).first(),
    ).toHaveValue("Beta Project");
    await expect(
      page.getByLabel("Institution", { exact: true }).first(),
    ).toHaveValue("New School");
    await page
      .getByRole("button", { name: "Move Old School up", exact: true })
      .click();
    await expect(
      page.getByLabel("Institution", { exact: true }).first(),
    ).toHaveValue("Old School");

    await page.getByText(/^Reorder technical skills/).click();
    const skills = page.getByRole("list", { name: "Technical skills order" });
    for (let count = 0; count < 2; count++) {
      await skills
        .locator(":scope > li")
        .filter({ hasText: "SQL" })
        .getByRole("button", { name: / up$/ })
        .click();
    }
    await expect(
      page.getByLabel("Technical skills", { exact: true }),
    ).toHaveValue("SQL\nReact\nTypeScript");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Saved to your workspace." }),
    ).toBeVisible();
    const saved = await (await request.get(`/api/cvs/${cv.id}`)).json();
    expect(saved.currentRevision).toBe(2);
    const content = saved.revisions[0].content;
    expect(content.experience.map((item: { id: string }) => item.id)).toEqual([
      "beta",
      "alpha",
    ]);
    expect(content.experience[1].role).toBe("Alpha Engineer edited");
    expect(content.projects[0].id).toBe("project-beta");
    expect(content.educationOrder).toEqual(["edu-old", "edu-new"]);
    expect(content.skills).toEqual(["SQL", "React", "TypeScript"]);
    expect(
      (
        await db.cvRevision.findUniqueOrThrow({
          where: { cvId_number: { cvId: cv.id, number: 1 } },
        })
      ).content,
    ).toEqual(original);

    await page.reload();
    await page
      .getByRole("button", { name: "Edit content", exact: true })
      .click();
    await expect(
      page.getByLabel("Job title", { exact: true }).first(),
    ).toHaveValue("Beta Engineer");
    await expect(
      page.getByLabel("Institution", { exact: true }).first(),
    ).toHaveValue("Old School");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("button", {
        name: "Move Beta Engineer at Beta Studio up",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Move Beta Engineer at Beta Studio down",
        exact: true,
      }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await roles
      .locator(":scope > li")
      .first()
      .screenshot({ path: ".data/screenshots/reorder-role-mobile.png" });

    const pdfResponse = await request.get(
      `/api/cvs/${cv.id}/export?format=pdf&revision=2`,
    );
    expect(pdfResponse.ok()).toBe(true);
    PDFParse.setWorker(getPath());
    const parser = new PDFParse({ data: await pdfResponse.body() });
    let pdfText: string;
    try {
      pdfText = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
    const docxResponse = await request.get(
      `/api/cvs/${cv.id}/export?format=docx&revision=2`,
    );
    expect(docxResponse.ok()).toBe(true);
    const wordText = (
      await mammoth.extractRawText({ buffer: await docxResponse.body() })
    ).value;
    for (const text of [pdfText, wordText]) {
      expect(text.indexOf("Beta Engineer")).toBeLessThan(
        text.indexOf("Alpha Engineer edited"),
      );
      expect(text.indexOf("Wrote deployment documentation.")).toBeLessThan(
        text.indexOf("Investigated session errors."),
      );
      expect(text.indexOf("Beta Project")).toBeLessThan(
        text.indexOf("Alpha Project"),
      );
      expect(text.indexOf("Old School")).toBeLessThan(
        text.indexOf("New School"),
      );
      expect(text).toContain("https://example.com/paper");
      expect(
        text.toLowerCase().indexOf("professional experience"),
      ).toBeLessThan(text.toLowerCase().indexOf("programs & projects"));
    }
  } finally {
    await db.cv.delete({ where: { id: cv.id } });
  }
});
