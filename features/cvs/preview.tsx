"use client";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import type { CvContent } from "@/lib/contracts";
import { documentBlocks } from "@/lib/template";
import { queries } from "@/lib/queries";
import { Button, ErrorNotice, Loading } from "@/components/ui";

const PdfPreview = dynamic(() => import("./pdf-preview"), {
  ssr: false,
  loading: () => <Loading label="Loading PDF viewer…" />,
});
export function CvPreview({
  content,
  id,
  revision,
}: {
  content: CvContent;
  id: string;
  revision: number;
}) {
  const pdf = useQuery(queries.cvs.pdf(id, revision));
  const openUrl = `/api/cvs/${id}/preview?revision=${revision}`;
  return (
    <article
      aria-label="CV preview"
      className="min-w-0 rounded-panel border border-border bg-muted p-3 md:p-5"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>ATS Classic · US Letter · revision {revision}</span>
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-control items-center font-semibold text-primary"
        >
          Open PDF ↗
        </a>
      </div>
      <ErrorNotice error={pdf.error} />
      {pdf.isPending ? (
        <Loading label="Preparing PDF preview…" />
      ) : pdf.data ? (
        <PdfPreview
          key={`${id}-${revision}`}
          bytes={pdf.data}
          openUrl={openUrl}
        />
      ) : (
        <Button variant="secondary" onClick={() => pdf.refetch()}>
          Retry PDF preview
        </Button>
      )}
      <div className="sr-only" aria-label="CV text alternative">
        {documentBlocks(content).map((block, index) => (
          <p key={index}>{block.text}</p>
        ))}
      </div>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        These are the actual PDF pages, including page breaks. DOCX pagination
        can vary by editor.
      </p>
    </article>
  );
}
