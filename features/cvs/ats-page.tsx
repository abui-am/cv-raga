"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { queries } from "@/lib/queries";
import {
  Empty,
  ErrorNotice,
  Field,
  Loading,
  PageHeader,
  Panel,
  Select,
  buttonClass,
} from "@/components/ui";
import { AssessmentPanel } from "./assessment-panel";

export function AtsPage() {
  const cvs = useQuery(queries.cvs.list);
  const [selected, setSelected] = useState("");
  const cv = cvs.data?.find((c) => c.id === selected) || cvs.data?.[0];
  return (
    <>
      <PageHeader
        eyebrow="05 / A clearer picture"
        title="Know where your CV stands."
        description="Check the document basics, then compare the accepted CV with a specific role. Every gap stays visible."
      />
      <ErrorNotice error={cvs.error} />
      {cvs.isPending ? (
        <Loading />
      ) : !cv ? (
        <Empty
          title="Start with a CV."
          description="Create a CV from your confirmed career details, then come back to check readiness and job alignment."
        >
          <Link
            href="/cvs"
            className={`${buttonClass} bg-primary text-primary-foreground`}
          >
            Go to my CVs
          </Link>
        </Empty>
      ) : (
        <>
          <Panel className="mb-6">
            <Field label="CV to assess">
              <Select
                value={cv.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {cvs.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} · revision {c.currentRevision}
                  </option>
                ))}
              </Select>
            </Field>
            <Link
              href={`/cvs/${cv.id}`}
              className="mt-3 inline-flex min-h-control items-center text-sm font-semibold text-primary"
            >
              Open CV & review content →
            </Link>
          </Panel>
          <AssessmentPanel key={cv.id} cv={cv} />
        </>
      )}
    </>
  );
}
