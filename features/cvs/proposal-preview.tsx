"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { type Cv } from "@/lib/contracts";
import { queries } from "@/lib/queries";
import { ErrorNotice, Loading, Panel } from "@/components/ui";
const PdfPreview = dynamic(() => import("./pdf-preview"), { ssr: false });
export function ProposalPreview({ cv }: { cv: Cv }) {
  const [open, setOpen] = useState(false);
  const ids = cv.suggestions
    .filter((s) => s.status === "pending")
    .map((s) => s.id);
  const pdf = useQuery({
    ...queries.cvs.proposal(cv.id, cv.currentRevision, ids),
    enabled: open && ids.length > 0,
  });
  return (
    <Panel>
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary className="min-h-control py-3 font-semibold text-primary">
          Preview the complete two-page proposal
        </summary>
        <p className="my-3 text-sm text-muted-foreground">
          This preview applies all pending changes together. Your accepted CV
          stays unchanged until you approve them.
        </p>
        <ErrorNotice error={pdf.error} />
        {pdf.isPending ? (
          <Loading label="Preparing proposal pages…" />
        ) : (
          pdf.data && (
            <PdfPreview
              key={ids.join("-")}
              bytes={pdf.data}
              openUrl={`/api/cvs/${cv.id}/proposal-preview?revision=${cv.currentRevision}`}
            />
          )
        )}
      </details>
    </Panel>
  );
}
