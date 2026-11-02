import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  Document,
  Page,
  Text,
  Link,
  Font,
  renderToBuffer,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  AlignmentType,
  BorderStyle,
  CharacterSet,
  Document as WordDocument,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
} from "docx";
import type { CvContent } from "@/lib/contracts";
import { documentBlocks, template } from "@/lib/template";
import type { DocumentBlock } from "@/lib/template";
import type { CoverLetterContent } from "@/lib/review-contracts";

const regular = path.join(process.cwd(), "public/fonts/Carlito-Regular.ttf");
const bold = path.join(process.cwd(), "public/fonts/Carlito-Bold.ttf");
Font.register({
  family: template.font,
  fonts: [{ src: regular }, { src: bold, fontWeight: 700 }],
});
Font.registerHyphenationCallback((word) => [word]);
const styles = StyleSheet.create({
  page: {
    padding: template.margin,
    fontFamily: template.font,
    fontSize: template.bodySize,
    color: "#000000",
    lineHeight: template.lineHeight,
  },
  name: {
    fontSize: template.nameSize,
    lineHeight: 1.2,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 6,
  },
  contact: {
    textAlign: "center",
    marginBottom: 2,
    fontSize: 10,
    lineHeight: 1.25,
  },
  section: {
    fontSize: template.headingSize,
    fontWeight: 700,
    textTransform: "uppercase",
    borderBottom: "0.6pt solid #000000",
    paddingBottom: 3,
    marginTop: 12,
    marginBottom: 5,
  },
  entry: { fontWeight: 700, marginTop: 6, marginBottom: 2 },
  meta: { marginBottom: 3 },
  text: { marginBottom: 4 },
  bullet: { paddingLeft: 10, marginBottom: 3 },
});
const linkParts = (text: string) => text.split(/(https?:\/\/[^\s<>()]+)/g);
const isLink = (text: string) => /^https?:\/\//.test(text);

function wordRuns(block: DocumentBlock) {
  const text = block.kind === "section" ? block.text.toUpperCase() : block.text;
  return linkParts(text).map((part) => {
    const run = new TextRun({
      text: part,
      font: template.font,
      color: "000000",
      underline: isLink(part) ? {} : undefined,
      bold: ["name", "section", "entry"].includes(block.kind),
      size:
        block.kind === "name"
          ? template.nameSize * 2
          : block.kind === "contact"
            ? 20
            : template.bodySize * 2,
    });
    return isLink(part)
      ? new ExternalHyperlink({ link: part, children: [run] })
      : run;
  });
}

export async function exportCv(content: CvContent, format: "pdf" | "docx") {
  const blocks = documentBlocks(content);
  return exportBlocks(blocks, content.name, format, "CV");
}
export async function exportLetter(
  content: CoverLetterContent,
  sender: CvContent,
  format: "pdf" | "docx",
) {
  const blocks: DocumentBlock[] = [
    { kind: "name", text: sender.name },
    {
      kind: "contact",
      text: [sender.email, sender.phone].filter(Boolean).join(" | "),
    },
    { kind: "entry", text: content.subject },
    { kind: "text", text: content.recipient },
    ...content.paragraphs.map((text) => ({ kind: "text" as const, text })),
    { kind: "text", text: content.closing },
    { kind: "text", text: sender.name },
  ];
  return exportBlocks(
    blocks.filter((b) => b.text.trim()),
    sender.name,
    format,
    "Cover letter",
  );
}
async function exportBlocks(
  blocks: DocumentBlock[],
  name: string,
  format: "pdf" | "docx",
  title: string,
) {
  if (format === "pdf")
    return renderToBuffer(
      <Document title={`${name} — ${title}`} author={name} language="en">
        <Page size="LETTER" style={styles.page} wrap>
          {blocks.map((block, i) => (
            <Text
              key={i}
              style={styles[block.kind]}
              orphans={2}
              widows={2}
              minPresenceAhead={
                block.kind === "section"
                  ? 48
                  : block.kind === "entry"
                    ? 36
                    : block.kind === "meta" && blocks[i + 1]?.kind === "bullet"
                      ? 18
                      : 0
              }
            >
              {linkParts(
                block.kind === "bullet" ? `• ${block.text}` : block.text,
              ).map((part, index) =>
                isLink(part) ? (
                  <Link
                    key={index}
                    src={part}
                    style={{ color: "#000000", textDecoration: "underline" }}
                  >
                    {part}
                  </Link>
                ) : (
                  part
                ),
              )}
            </Text>
          ))}
        </Page>
      </Document>,
    );
  const [fontData, boldData] = await Promise.all([
    readFile(regular),
    readFile(bold),
  ]);
  const doc = new WordDocument({
    title: `${name} — ${title}`,
    creator: name,
    fonts: [
      {
        name: template.font,
        data: fontData,
        bold: boldData,
        characterSet: CharacterSet.DEFAULT,
      },
    ],
    styles: {
      default: {
        document: {
          run: {
            font: template.font,
            size: template.bodySize * 2,
            color: "000000",
          },
          paragraph: { spacing: { after: 60, line: 300 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: template.width * 20, height: template.height * 20 },
            margin: {
              top: template.margin * 20,
              bottom: template.margin * 20,
              left: template.margin * 20,
              right: template.margin * 20,
            },
          },
        },
        children: blocks.map(
          (b, i) =>
            new Paragraph({
              children: wordRuns(b),
              alignment:
                b.kind === "name" || b.kind === "contact"
                  ? AlignmentType.CENTER
                  : AlignmentType.LEFT,
              keepNext:
                ["section", "entry"].includes(b.kind) ||
                (b.kind === "meta" && blocks[i + 1]?.kind === "bullet"),
              keepLines: b.kind !== "text",
              widowControl: true,
              spacing: {
                before:
                  b.kind === "section" ? 240 : b.kind === "entry" ? 120 : 0,
                after: b.kind === "section" ? 100 : 60,
              },
              ...(b.kind === "bullet" ? { bullet: { level: 0 } } : {}),
              ...(b.kind === "section"
                ? {
                    border: {
                      bottom: {
                        color: "000000",
                        size: 4,
                        style: BorderStyle.SINGLE,
                      },
                    },
                  }
                : {}),
            }),
        ),
      },
    ],
  });
  return Packer.toBuffer(doc);
}
