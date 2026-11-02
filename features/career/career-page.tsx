"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, FileUp, Sparkles } from "lucide-react";
import { emptyContent, type CvContent, type Source } from "@/lib/contracts";
import { mergeCareer } from "@/lib/career";
import { queries } from "@/lib/queries";
import { useSaveProfile } from "@/lib/use-actions";
import { profileApi } from "@/features/profile/api";
import { EvidenceLibrary } from "@/features/knowledge/knowledge-page";
import { DocumentForm } from "@/components/document-form";
import { SourceImport } from "@/components/source-import";
import {
  Badge,
  Button,
  ErrorNotice,
  Field,
  Loading,
  PageHeader,
  Panel,
  Select,
} from "@/components/ui";

type Section = "details" | "history" | "evidence";
export function CareerPage({
  initialSection = "details",
}: {
  initialSection?: Section;
}) {
  const profile = useQuery(queries.profile.detail);
  const settings = useQuery(queries.settings.detail);
  const save = useSaveProfile();
  const [section, setSection] = useState<Section>(initialSection);
  const [showImport, setShowImport] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [destination, setDestination] = useState<"history" | "evidence">(
    "history",
  );
  const [formDirty, setFormDirty] = useState(false);
  const [evidenceDirty, setEvidenceDirty] = useState(false);
  const [draft, setDraft] = useState<{
    content: CvContent;
    key: number;
  } | null>(null);
  const [evidenceRequest, setEvidenceRequest] = useState<{
    key: number;
    careerEntryId?: string;
    source?: Source;
  } | null>(null);
  const extract = useMutation({
    mutationFn: profileApi.extract,
    retry: false,
    onSuccess: (content) => {
      setDraft({
        content: profile.data
          ? mergeCareer(profile.data.content, content)
          : content,
        key: Date.now(),
      });
      setSection("history");
      setShowImport(false);
      setSource(null);
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Your foundation"
        title="My career"
        description="Your details, experience, and supporting evidence, together. Keep your career facts here and build a CV for each opportunity."
        action={
          <Button
            variant="secondary"
            onClick={() => setShowImport(!showImport)}
          >
            <FileUp size={16} aria-hidden="true" />
            {showImport ? "Close import" : "Import a document"}
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Career sections"
          className="flex flex-wrap gap-1 rounded-control bg-muted p-1"
        >
          {(
            [
              ["details", "Personal details"],
              ["history", "Career history"],
              ["evidence", "Supporting evidence"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              variant="quiet"
              aria-pressed={section === id}
              aria-controls={
                id === "evidence" ? "career-evidence" : "career-record"
              }
              className={section === id ? "bg-card text-primary" : ""}
              onClick={() => setSection(id)}
            >
              {label}
            </Button>
          ))}
        </nav>
        {profile.data && (
          <Badge tone="good">
            <Check size={12} aria-hidden="true" className="mr-1" />
            Confirmed · v{profile.data.revision}
          </Badge>
        )}
      </div>
      {(showImport || (profile.isSuccess && !profile.data)) && (
        <div className="mb-6 space-y-4">
          <SourceImport
            onSource={(value) => {
              setSource(value);
              extract.reset();
            }}
          />
          {source && (
            <Panel>
              <h2 className="text-lg font-semibold">{source.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review this document before adding its facts to your career.
              </p>
              <details className="my-4">
                <summary className="min-h-control cursor-pointer py-3 text-sm font-medium text-primary">
                  Review extracted text
                </summary>
                <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-control bg-background p-4 font-sans text-sm leading-relaxed">
                  {source.text}
                </pre>
              </details>
              <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Field label="Add to">
                  <Select
                    value={destination}
                    onChange={(event) =>
                      setDestination(event.target.value as typeof destination)
                    }
                  >
                    <option value="history">Career history</option>
                    <option value="evidence">Supporting evidence</option>
                  </Select>
                </Field>
                <Button
                  busy={extract.isPending}
                  disabled={
                    destination === "history" &&
                    (!settings.data?.aiConfigured ||
                      formDirty ||
                      profile.isPending ||
                      profile.isError)
                  }
                  onClick={() => {
                    if (destination === "history") extract.mutate(source.id);
                    else {
                      if (
                        evidenceDirty &&
                        !confirm("Discard unsaved evidence changes?")
                      )
                        return;
                      setEvidenceRequest({ key: Date.now(), source });
                      setSection("evidence");
                      setShowImport(false);
                      setSource(null);
                    }
                  }}
                >
                  {destination === "history" && (
                    <Sparkles size={16} aria-hidden="true" />
                  )}
                  {extract.isPending
                    ? "Preparing career draft…"
                    : destination === "history"
                      ? "Review career draft"
                      : "Review supporting evidence"}
                </Button>
              </div>
              {destination === "history" && !settings.data?.aiConfigured && (
                <p className="mt-3 text-sm text-muted-foreground">
                  AI import is unavailable. You can enter career details below
                  or save this document as supporting evidence.
                </p>
              )}
              {formDirty && destination === "history" && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Save your career edits before reviewing another import.
                </p>
              )}
              <ErrorNotice error={extract.error} />
            </Panel>
          )}
        </div>
      )}
      <div hidden={section === "evidence"} id="career-record">
        {draft && !save.isSuccess && (
          <p
            role="status"
            className="mb-5 rounded-control bg-accent p-4 text-sm text-primary"
          >
            Review your imported career details, including Personal details,
            then confirm once. Existing entries are preserved and matching roles
            and projects are merged.
          </p>
        )}
        {profile.isPending ? (
          <Loading />
        ) : profile.isError ? (
          <>
            <ErrorNotice error={profile.error} />
            <Button variant="secondary" onClick={() => profile.refetch()}>
              Retry
            </Button>
          </>
        ) : (
          <DocumentForm
            key={draft?.key || "career"}
            initial={draft?.content || profile.data?.content || emptyContent}
            revision={profile.data?.revision || 0}
            careerSection={section === "details" ? "details" : "history"}
            onDirtyChange={setFormDirty}
            onCareerSectionChange={setSection}
            label="Confirm & save career"
            pending={save.isPending}
            error={save.error}
            onAddEvidence={(careerEntryId) => {
              if (
                evidenceDirty &&
                !confirm("Discard unsaved evidence changes?")
              )
                return;
              setEvidenceRequest({ key: Date.now(), careerEntryId });
              setSection("evidence");
            }}
            onSave={async (content, revision) => {
              const result = await save.mutateAsync({ content, revision });
              if (!result)
                throw new Error("Career details could not be saved.");
              return { content: result.content, revision: result.revision };
            }}
          />
        )}
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          These confirmed facts are the starting point for new CVs. Career edits
          apply to future tailoring; your saved CV versions stay intact.
        </p>
      </div>
      <div hidden={section !== "evidence"} id="career-evidence">
        <EvidenceLibrary
          key={evidenceRequest?.key || "evidence"}
          initialSource={evidenceRequest?.source}
          initialCareerEntryId={evidenceRequest?.careerEntryId}
          onDirtyChange={setEvidenceDirty}
        />
      </div>
    </>
  );
}
