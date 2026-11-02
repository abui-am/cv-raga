import { expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import { getPath } from "pdf-parse/worker";
import mammoth from "mammoth";
import { exportCv } from "../lib/server/export";
import { emptyContent } from "../lib/contracts";
import {
  checkCvExports,
  measureCv,
  measureCvLayout,
} from "../lib/server/export-quality";
import { fitByPriority, priorityTargets } from "../lib/server/prioritize-cv";
import { template } from "../lib/template";

it("exports stated language proficiency without upgrading the candidate's level", async () => {
  const content = {
    ...emptyContent,
    name: "Alex Example",
    languages: ["English — B2 (Upper Intermediate)", "Indonesian — Native"],
  };
  const checked = await checkCvExports(content);
  expect(checked.result.passed).toBe(true);
  PDFParse.setWorker(getPath());
  const parser = new PDFParse({ data: checked.pdf });
  try {
    const text = (await parser.getText()).text;
    expect(text).toContain("LANGUAGES");
    for (const language of content.languages) expect(text).toContain(language);
    expect(text).not.toContain("C1");
  } finally {
    await parser.destroy();
  }
  const word = (await mammoth.extractRawText({ buffer: checked.docx })).value;
  for (const language of content.languages) expect(word).toContain(language);
});

it("exports a visible, clickable publication URL in both PDF and DOCX", async () => {
  const url = "https://ieeexplore.ieee.org/document/11715165";
  const content = {
    ...emptyContent,
    name: "Alex Example",
    certifications: [`IEEE: Hybrid fine-tuning + RAG — ${url}`],
  };
  const pdf = await exportCv(content, "pdf");
  PDFParse.setWorker(getPath());
  const parser = new PDFParse({ data: pdf });
  try {
    const info = await parser.getInfo({ parsePageInfo: true });
    expect(
      info.pages.flatMap((page) => page.links).some((link) => link.url === url),
    ).toBe(true);
    expect((await parser.getText()).text).toContain(url);
  } finally {
    await parser.destroy();
  }
  const docx = await exportCv(content, "docx");
  const html = await mammoth.convertToHtml({ buffer: docx });
  expect(html.value).toContain(`href="${url}"`);
  expect(html.value).toContain(url);
  expect((await checkCvExports(content)).result.passed).toBe(true);
});

it("keeps content readable across multiple pages and groups role headings with employers", async () => {
  const content = {
    ...emptyContent,
    name: "Alex Example",
    headline: "Frontend Engineer",
    email: "alex@example.com",
    location: "Jakarta, Indonesia",
    summary:
      "Frontend engineer developing accessible web applications with TypeScript, React and Next.js. Experienced in unit testing, application support and technical documentation.",
    skills: ["TypeScript", "React", "Next.js", "Docker", "Testing"],
    experience: Array.from({ length: 7 }, (_, i) => ({
      id: `role${i}`,
      role: `Frontend Engineer ${i + 1}`,
      company: `Example Company ${i + 1}`,
      period: "Apr 2022 – Present",
      bullets: [
        `Delivered application workflow ${i + 1} using React and TypeScript, working with designers and backend engineers to clarify requirements and deliver accessible interactions.`,
        `Wrote unit tests for workflow ${i + 1} and documented integration behavior, error recovery, and maintenance steps for the engineering team.`,
        `Investigated performance issues in workflow ${i + 1}, reviewed browser traces, and improved component rendering while preserving existing functionality.`,
      ],
    })),
    education: [
      {
        id: "edu",
        institution: "Example University",
        qualification: "Bachelor of Computer Science",
        period: "2018–2022",
      },
    ],
  };
  const pdf = await exportCv(content, "pdf");
  PDFParse.setWorker(getPath());
  const parser = new PDFParse({ data: pdf });
  try {
    const result = await parser.getText();
    expect(result.total).toBeGreaterThan(1);
    for (const role of content.experience) {
      const page = result.pages.find((p) => p.text.includes(role.role));
      expect(page?.text).toContain(role.company);
      for (const bullet of role.bullets)
        expect(result.text.replace(/\s+/g, " ")).toContain(bullet);
    }
    expect(result.text).toContain("Example University");
  } finally {
    await parser.destroy();
  }
  const word = await exportCv(content, "docx");
  const extracted = (await mammoth.extractRawText({ buffer: word })).value;
  for (const role of content.experience) {
    expect(extracted).toContain(role.role);
    for (const bullet of role.bullets) expect(extracted).toContain(bullet);
  }
  expect(extracted).toContain("Bachelor of Computer Science");
  await mkdir(".data/qa", { recursive: true });
  await writeFile(".data/qa/ats-classic-regression.pdf", pdf);
}, 30000);

it("distinguishes a short or sparse PDF from two pages filled to the normal print margins", async () => {
  const content = {
    ...emptyContent,
    name: "Alex Example",
    summary: "Engineer building tested applications.",
    experience: [
      {
        id: "role",
        company: "Example",
        role: "Engineer",
        period: "2022–2026",
        bullets: [] as string[],
      },
    ],
  };
  const short = await measureCvLayout(content);
  expect(short.pages).toBe(1);
  expect(short.full).toBe(false);
  let sawSparseSecondPage = false;
  let full = false;
  for (let count = 12; count <= 48; count++) {
    const layout = await measureCvLayout({
      ...content,
      experience: [
        {
          ...content.experience[0],
          bullets: Array.from(
            { length: count },
            (_, i) =>
              `Delivered application workflow ${i + 1} using React and TypeScript, working with designers and backend engineers to clarify requirements, document integration behavior, and test accessible interactions before release.`,
          ),
        },
      ],
    });
    if (layout.pages === 2 && !layout.full) sawSparseSecondPage = true;
    if (layout.full) {
      expect(layout.pages).toBe(2);
      expect(layout.pageFill.every((fill) => fill >= 0.94)).toBe(true);
      full = true;
      break;
    }
    if (layout.pages > 2) break;
  }
  expect(sawSparseSecondPage).toBe(true);
  expect(full).toBe(true);
  expect(template.bodySize).toBe(11);
}, 30000);

it("fits a real oversized PDF through prioritized omissions at the fixed 11pt font", async () => {
  const content = {
    ...emptyContent,
    name: "Alex Example",
    email: "alex@example.com",
    skills: ["React", "TypeScript", "Testing"],
    summary:
      "Engineer building tested React applications with clear documentation.",
    experience: Array.from({ length: 16 }, (_, i) => ({
      id: `role${i}`,
      role: `Engineer ${i + 1}`,
      company: `Example ${i + 1}`,
      period: "2020–2025",
      bullets: Array.from(
        { length: 3 },
        (_, n) =>
          `Delivered workflow ${i + 1}.${n + 1} using React and TypeScript, collaborating with designers and backend engineers to clarify business requirements, test integration behavior and document accessible application workflows.`,
      ),
    })),
    projects: [
      {
        id: "old",
        name: "Older prototype",
        detail: "Unrelated project",
        bullets: ["Built an unrelated prototype"],
      },
    ],
  };
  expect(await measureCv(content)).toBeGreaterThan(2);
  const priorities = priorityTargets(content).map((p) => ({
    target: p.target,
    rank:
      p.target === "projects:old"
        ? 100
        : p.target === "experience:role0"
          ? 1
          : p.target.startsWith("experience:")
            ? 60
            : 2,
    reason: "Retain the most recent relevant React evidence",
  }));
  const fitted = await fitByPriority(content, priorities);
  const { result } = await checkCvExports(fitted.content);
  expect(result.pdfPages).toBeLessThanOrEqual(2);
  expect(result.passed).toBe(true);
  expect(template.bodySize).toBe(11);
  expect(fitted.content.experience[0].id).toBe("role0");
  expect(fitted.content.experience.some((role) => role.id === "role1")).toBe(
    true,
  );
  expect(fitted.content.experience[0].bullets.length).toBeGreaterThan(0);
  expect(fitted.content.name).toBe(content.name);
  expect(content.experience).toHaveLength(16);
  for (const role of fitted.content.experience) {
    const original = content.experience.find((e) => e.id === role.id)!;
    expect(role.company).toBe(original.company);
    expect(role.period).toBe(original.period);
    expect(role.bullets.every((b) => original.bullets.includes(b))).toBe(true);
  }
}, 30000);
