"use client";
import { useEffect, useRef, useState } from "react";
import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
  RenderTask,
} from "pdfjs-dist";
import { Button, ErrorNotice, Loading } from "@/components/ui";

function PdfPage({
  document,
  number,
}: {
  document: PDFDocumentProxy;
  number: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!width || !canvas.current) return;
    let canceled = false;
    let task: RenderTask | undefined;
    const element = canvas.current;
    void document
      .getPage(number)
      .then((page) => {
        if (canceled) return;
        const base = page.getViewport({ scale: 1 });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({
          scale: (width / base.width) * ratio,
        });
        element.width = Math.ceil(viewport.width);
        element.height = Math.ceil(viewport.height);
        const context = element.getContext("2d");
        if (!context)
          throw new Error(
            "This browser cannot render the preview. Open the PDF instead.",
          );
        task = page.render({
          canvas: element,
          canvasContext: context,
          viewport,
        });
        return task.promise;
      })
      .catch((reason) => {
        if (!canceled && reason?.name !== "RenderingCancelledException")
          setError(
            new Error(
              "This PDF page could not be displayed. Open the PDF to inspect it.",
            ),
          );
      });
    return () => {
      canceled = true;
      task?.cancel();
    };
  }, [document, number, width]);
  return (
    <figure
      className="mx-auto w-full max-w-[816px]"
      aria-label={`PDF page ${number} of ${document.numPages}`}
    >
      <figcaption className="mb-2 text-center text-xs font-medium text-muted-foreground">
        Page {number} of {document.numPages}
      </figcaption>
      <div
        ref={container}
        className="overflow-hidden border border-border bg-white"
        style={{ aspectRatio: "612 / 792" }}
      >
        <canvas
          ref={canvas}
          aria-hidden="true"
          className="block h-auto w-full"
        />
      </div>
      <ErrorNotice error={error} />
    </figure>
  );
}
export default function PdfPreview({
  bytes,
  openUrl,
}: {
  bytes: ArrayBuffer;
  openUrl: string;
}) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let canceled = false;
    let task: PDFDocumentLoadingTask | undefined;
    void import("pdfjs-dist")
      .then(async (pdfjs) => {
        if (canceled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        // PDF.js transfers its data to a worker. Keep the Query cache's buffer intact.
        task = pdfjs.getDocument({
          data: new Uint8Array(bytes.slice(0)),
          isEvalSupported: false,
        });
        const loaded = await task.promise;
        if (!canceled) setDocument(loaded);
      })
      .catch(() => {
        if (!canceled)
          setError(
            new Error(
              "The paginated preview could not be displayed. You can open the PDF directly.",
            ),
          );
      });
    return () => {
      canceled = true;
      void task?.destroy().catch(() => {});
    };
  }, [bytes]);
  if (error)
    return (
      <div>
        <ErrorNotice error={error} />
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-primary"
        >
          Open PDF
        </a>
        <Button variant="quiet" onClick={() => window.location.reload()}>
          Reload preview
        </Button>
      </div>
    );
  if (!document) return <Loading label="Rendering PDF pages…" />;
  return (
    <div className="space-y-6" aria-label={`${document.numPages} PDF pages`}>
      <p
        role="status"
        className={`rounded-control p-3 text-sm ${document.numPages > 2 ? "bg-warning text-warning-foreground" : "bg-accent text-primary"}`}
      >
        {document.numPages} {document.numPages === 1 ? "page" : "pages"} ·
        maximum 2 for your CV
        {document.numPages > 2
          ? ". Tailor or shorten this CV before downloading."
          : ""}
      </p>
      {Array.from({ length: document.numPages }, (_, index) => (
        <PdfPage key={index} document={document} number={index + 1} />
      ))}
    </div>
  );
}
