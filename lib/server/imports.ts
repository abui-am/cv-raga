import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { database } from "./db";
import { HttpError, readBody } from "./http";

export async function importSource(request: Request) {
  const bytes = await readBody(request, 11 * 1024 * 1024);
  const form = await new Response(bytes, {
    headers: { "content-type": request.headers.get("content-type") || "" },
  }).formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size)
    throw new HttpError(400, "Choose a PDF, DOCX or TXT file.");
  if (file.size > 10 * 1024 * 1024)
    throw new HttpError(413, "Use a file smaller than 10 MB.");
  const extension = path.extname(file.name).toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    if (extension === ".pdf" && buffer.subarray(0, 5).toString() === "%PDF-") {
      const { getPath } = await import("pdf-parse/worker");
      const { PDFParse } = await import("pdf-parse");
      PDFParse.setWorker(getPath());
      const parser = new PDFParse({ data: buffer, isEvalSupported: false });
      try {
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    } else if (
      extension === ".docx" &&
      buffer.subarray(0, 2).toString() === "PK"
    ) {
      const mammoth = await import("mammoth");
      // Mammoth disables external-file access by default; only consume raw text.
      text = (await mammoth.extractRawText({ buffer })).value;
    } else if (extension === ".txt" && !buffer.includes(0)) {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } else throw new Error("Unsupported document");
  } catch {
    throw new HttpError(
      422,
      "This document could not be read. Use an unencrypted text-based PDF, DOCX or UTF-8 TXT, or paste its text instead. Scanned PDFs need OCR first.",
    );
  }
  text = text.replace(/\u0000/g, "").trim();
  if (text.length < 20)
    throw new HttpError(
      422,
      "No usable text was found. Paste the text instead; scanned PDFs need OCR first.",
    );
  if (text.length > 20000)
    throw new HttpError(
      422,
      "This document exceeds 20,000 extracted characters. Import a shorter document or paste the relevant excerpt.",
    );
  const folder = path.join(process.cwd(), ".data", "uploads");
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const storagePath = path.join(folder, `${randomUUID()}${extension}`);
  await writeFile(storagePath, buffer, { mode: 0o600, flag: "wx" });
  try {
    return await database().source.create({
      data: { name: path.basename(file.name).slice(0, 500), text, storagePath },
    });
  } catch (error) {
    await unlink(storagePath);
    throw error;
  }
}
