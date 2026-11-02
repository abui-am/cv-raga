"use client";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button, ErrorNotice } from "@/components/ui";

export function Downloads({ id, revision }: { id: string; revision: number }) {
  const download = useMutation({
    retry: false,
    mutationFn: async (format: "pdf" | "docx") => {
      const response = await fetch(
        `/api/cvs/${id}/export?format=${format}&revision=${revision}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error || "Export failed. Check PostgreSQL and try again.",
        );
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download =
        response.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/)?.[1] || `cv-v${revision}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
    },
  });
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          busy={download.isPending && download.variables === "pdf"}
          disabled={download.isPending}
          onClick={() => download.mutate("pdf")}
        >
          <Download size={15} aria-hidden="true" />
          PDF
        </Button>
        <Button
          variant="secondary"
          busy={download.isPending && download.variables === "docx"}
          disabled={download.isPending}
          onClick={() => download.mutate("docx")}
        >
          <Download size={15} aria-hidden="true" />
          DOCX
        </Button>
      </div>
      <ErrorNotice error={download.error} />
    </div>
  );
}
