import "server-only";
import path from "node:path";
import { z } from "zod";
import type { CvContent } from "@/lib/contracts";
import {
  CV_MIN_PAGE_FILL,
  CV_PAGE_LIMIT,
  exportCheckResultSchema,
} from "@/lib/export-contracts";
import { documentBlocks, template, type DocumentBlock } from "@/lib/template";
import { exportCv } from "./export";

const flatten = (text: string) =>
  text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
export function inspectReadingOrder(
  blocks: DocumentBlock[],
  pageTexts: string[],
) {
  const pages = pageTexts.map(flatten);
  const text = pages.join("");
  const boundaries = pages.map((_, index) =>
    pages.slice(0, index + 1).reduce((sum, p) => sum + p.length, 0),
  );
  const positions: number[] = [];
  let cursor = 0;
  let readingOrder = true;
  for (const block of blocks) {
    const found = text.indexOf(flatten(block.text), cursor);
    positions.push(found);
    if (found < 0) {
      readingOrder = false;
      continue;
    }
    cursor = found + flatten(block.text).length;
  }
  const pageAt = (offset: number) =>
    boundaries.findIndex((end) => offset < end);
  const headingGroups =
    readingOrder &&
    blocks.every((block, index) => {
      if (!["section", "entry"].includes(block.kind) || !blocks[index + 1])
        return true;
      return pageAt(positions[index]) === pageAt(positions[index + 1]);
    });
  return { readingOrder, headingGroups };
}
async function pdfText(buffer: Buffer) {
  const [{ PDFParse }, { getPath }] = await Promise.all([
    import("pdf-parse"),
    import("pdf-parse/worker"),
  ]);
  PDFParse.setWorker(getPath());
  const parser = new PDFParse({ data: buffer, isEvalSupported: false });
  try {
    const result = await parser.getText();
    return result.pages.map((p) => p.text);
  } finally {
    await parser.destroy();
  }
}
export async function measureCv(content: CvContent) {
  return (await pdfText(await exportCv(content, "pdf"))).length;
}
export type CvLayout = { pages: number; pageFill: number[]; full: boolean };

/** Measure real text baselines inside the fixed print margins, never estimated word counts. */
export async function measureCvLayout(content: CvContent): Promise<CvLayout> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  );
  const task = pdfjs.getDocument({
    data: new Uint8Array(await exportCv(content, "pdf")),
    isEvalSupported: false,
  });
  try {
    const pdf = await task.promise;
    const pageFill: number[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const text = await page.getTextContent();
      let bottom: number = template.margin;
      for (const item of text.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [, y] = viewport.convertToViewportPoint(
          item.transform[4],
          item.transform[5],
        );
        bottom = Math.max(bottom, y + item.height * 0.25);
      }
      pageFill.push(
        Math.max(
          0,
          Math.min(
            1,
            (bottom - template.margin) /
              (viewport.height - 2 * template.margin),
          ),
        ),
      );
      page.cleanup();
    }
    return {
      pages: pdf.numPages,
      pageFill,
      full:
        pdf.numPages === CV_PAGE_LIMIT &&
        pageFill.every((fill) => fill >= CV_MIN_PAGE_FILL),
    };
  } finally {
    await task.destroy();
  }
}
export async function checkCvExports(content: CvContent): Promise<{
  result: z.infer<typeof exportCheckResultSchema>;
  pdf: Buffer;
  docx: Buffer;
}> {
  const [pdf, docx] = await Promise.all([
    exportCv(content, "pdf"),
    exportCv(content, "docx"),
  ]);
  const [pages, mammoth] = await Promise.all([pdfText(pdf), import("mammoth")]);
  const word = await mammoth.extractRawText({ buffer: docx });
  const blocks = documentBlocks(content);
  const pdfCheck = inspectReadingOrder(blocks, pages);
  const wordCheck = inspectReadingOrder(blocks, [word.value]);
  const result = {
    pdfPages: pages.length,
    maxPages: CV_PAGE_LIMIT,
    pdfReadingOrder: pdfCheck.readingOrder,
    headingGroups: pdfCheck.headingGroups,
    docxReadingOrder: wordCheck.readingOrder,
    passed:
      pages.length <= CV_PAGE_LIMIT &&
      pdfCheck.readingOrder &&
      pdfCheck.headingGroups &&
      wordCheck.readingOrder,
  };
  return { result, pdf, docx };
}
