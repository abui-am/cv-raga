"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Check,
  FileText,
  Plus,
  Sparkles,
  Undo2,
} from "lucide-react";
import { type Cv, type Suggestion } from "@/lib/contracts";
import { isSelectionTarget, selectionPreview } from "@/lib/domain";
import { queries } from "@/lib/queries";
import { useCvActions } from "@/lib/use-actions";
import { DocumentForm, useUnsavedChanges } from "@/components/document-form";
import {
  Badge,
  Button,
  Empty,
  ErrorNotice,
  Field,
  Input,
  Loading,
  PageHeader,
  Panel,
  RowArrow,
  Select,
  Textarea,
  buttonClass,
} from "@/components/ui";
import { CvPreview } from "./preview";
import { Downloads } from "./downloads";
import { ReviewProvider, useReviewStore } from "./review-store";
import { AssessmentPanel } from "./assessment-panel";
import { CoverLetterPanel } from "./cover-letter";
import { PersonaReviews } from "./persona-reviews";
import { ProposalPreview } from "./proposal-preview";
import { CvAssistant } from "./assistant";

const createSchema = z.object({
  title: z.string().trim().min(1, "Give your CV a name").max(500),
  applicationId: z.string(),
  baseCvId: z.string(),
});
export function CvsPage() {
  const cvs = useQuery(queries.cvs.list);
  const applications = useQuery(
    queries.applications.list({ search: "", status: "" }),
  );
  const [adding, setAdding] = useState(false);
  const { create } = useCvActions();
  const router = useRouter();
  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "", applicationId: "", baseCvId: "" },
  });
  return (
    <>
      <PageHeader
        eyebrow="04 / Your documents"
        title="The right story for each role."
        description="One consistent template. Separate, editable versions for every opportunity."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden="true" />
            Create a CV
          </Button>
        }
      />
      <div className="mb-8 flex flex-wrap items-center gap-5 rounded-panel border border-border bg-accent p-6">
        <span className="flex size-12 items-center justify-center rounded-control bg-card text-primary">
          <FileText size={24} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">ATS Classic</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            A clean, single-column template inspired by your reference. Readable
            text, familiar sections, and natural pagination.
          </p>
        </div>
        <Badge tone="good">PDF + DOCX</Badge>
      </div>
      {adding && (
        <Panel className="mb-8">
          <h2 className="mb-5 text-lg font-semibold">Create a new CV</h2>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (data) => {
              try {
                const cv = await create.mutateAsync({
                  title: data.title,
                  applicationId: data.applicationId || null,
                  baseCvId: data.baseCvId || null,
                });
                form.reset();
                router.push(`/cvs/${cv.id}`);
              } catch {}
            })}
          >
            <Field label="CV name" error={form.formState.errors.title?.message}>
              <Input
                {...form.register("title")}
                placeholder="e.g. General CV or Frontend Engineer — Company"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Application">
                <Select {...form.register("applicationId")}>
                  <option value="">General CV</option>
                  {applications.data?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.role} — {a.company}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Start from">
                <Select {...form.register("baseCvId")}>
                  <option value="">Confirmed career details</option>
                  {cvs.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} · v{c.currentRevision}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <ErrorNotice error={create.error} />
            <div className="flex gap-2">
              <Button type="submit" busy={create.isPending}>
                Create CV
              </Button>
              <Button variant="quiet" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Panel>
      )}
      <ErrorNotice error={cvs.error || applications.error} />
      {cvs.isPending ? (
        <Loading />
      ) : !cvs.data?.length ? (
        <Empty
          title="Your first CV is one step away."
          description="Confirm your career details, then create a general CV or a version linked to a job application."
        >
          <Button variant="secondary" onClick={() => setAdding(true)}>
            Create your first CV
          </Button>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cvs.data.map((cv) => {
            const match = cv.assessments.find((a) => !a.stale);
            return (
              <Link
                href={`/cvs/${cv.id}`}
                key={cv.id}
                className="group rounded-panel border border-border bg-card p-6 hover:border-input"
              >
                <div className="mb-6 flex items-start justify-between">
                  <FileText
                    size={24}
                    aria-hidden="true"
                    className="text-primary"
                  />
                  <RowArrow />
                </div>
                <h2 className="font-semibold [overflow-wrap:anywhere]">
                  {cv.title}
                </h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  ATS Classic · Revision {cv.currentRevision} ·{" "}
                  {cv.applicationId ? "Application CV" : "General CV"}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Badge>
                    {new Date(cv.updatedAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </Badge>
                  {match && (
                    <Badge tone={match.score > 90 ? "good" : "warning"}>
                      {match.score}/100 Match
                    </Badge>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

const suggestionForm = z.object({ text: z.string().trim().max(50000) });
function SuggestionCard({
  suggestion,
  cv,
  onEdited,
}: {
  suggestion: Suggestion;
  cv: Cv;
  onEdited: (id: string, dirty: boolean) => void;
}) {
  const { action } = useCvActions();
  const selection = isSelectionTarget(suggestion.target);
  const form = useForm<{ text: string }>({
    resolver: zodResolver(suggestionForm),
    defaultValues: { text: suggestion.proposed },
  });
  const dirty = form.formState.isDirty && suggestion.status === "pending";
  useUnsavedChanges(dirty);
  useEffect(() => {
    onEdited(suggestion.id, dirty);
    return () => onEdited(suggestion.id, false);
  }, [dirty, suggestion.id, onEdited]);
  const decide = (
    decision: "accept" | "reject" | "undo",
    text = suggestion.proposed,
  ) =>
    action.mutate({
      id: cv.id,
      action: "suggestion",
      suggestionId: suggestion.id,
      decision,
      text,
      revision: cv.currentRevision,
    });
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Badge tone={suggestion.status === "accepted" ? "good" : "neutral"}>
          {suggestion.status === "pending"
            ? "For your review"
            : suggestion.status === "generated"
              ? "AI generated"
              : suggestion.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Based on CV v{suggestion.baseRevision}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Original
          </h3>
          <p className="rounded-control bg-background p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {selectionPreview(suggestion.target, suggestion.original) ||
              "No text yet"}
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
            Suggested
          </h3>
          {suggestion.status === "pending" && !selection ? (
            <Field
              label="Proposed wording"
              hint="An empty value removes optional content from this CV. The original stays in version history."
              error={form.formState.errors.text?.message}
            >
              <Textarea {...form.register("text")} rows={6} />
            </Field>
          ) : (
            <p className="rounded-control bg-accent p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {selectionPreview(suggestion.target, suggestion.proposed) ||
                "Omitted from this CV to prioritize relevant content."}
            </p>
          )}
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {suggestion.rationale}
      </p>
      <details className="mt-3">
        <summary className="min-h-control py-3 text-sm font-medium text-primary">
          Supporting evidence ({suggestion.sources.length})
        </summary>
        <div className="space-y-3">
          {suggestion.sources.map((source) => (
            <div
              key={source.id}
              className="rounded-control border border-border p-4"
            >
              <p className="mb-2 text-sm font-semibold">{source.title}</p>
              <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {source.text}
              </p>
            </div>
          ))}
        </div>
      </details>
      <ErrorNotice error={action.error} />
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestion.status === "pending" && (
          <>
            <Button
              busy={action.isPending}
              onClick={form.handleSubmit((data) => decide("accept", data.text))}
            >
              <Check size={15} aria-hidden="true" />
              {selection || !suggestion.proposed
                ? "Accept selection"
                : "Accept wording"}
            </Button>
            <Button
              variant="secondary"
              disabled={action.isPending}
              onClick={() => decide("reject")}
            >
              Keep original
            </Button>
          </>
        )}
        {suggestion.status === "accepted" && (
          <Button
            variant="secondary"
            busy={action.isPending}
            onClick={() => decide("undo")}
          >
            <Undo2 size={15} aria-hidden="true" />
            Undo change
          </Button>
        )}
      </div>
    </Panel>
  );
}
function CvWorkspace({ id }: { id: string }) {
  const cv = useQuery(queries.cvs.detail(id));
  const settings = useQuery(queries.settings.detail);
  const applications = useQuery({
    ...queries.applications.list({ search: "", status: "" }),
    enabled: Boolean(cv.data && !cv.data.applicationId),
  });
  const { save, action, createForRole } = useCvActions();
  const router = useRouter();
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const panel = useReviewStore((s) => s.panel);
  const setPanel = useReviewStore((s) => s.setPanel);
  const [formDirty, setFormDirty] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [reviewEdits, setReviewEdits] = useState<Record<string, boolean>>({});
  const onEdited = useCallback(
    (suggestionId: string, dirty: boolean) =>
      setReviewEdits((current) =>
        current[suggestionId] === dirty
          ? current
          : { ...current, [suggestionId]: dirty },
      ),
    [],
  );
  const hasReviewEdits = Object.values(reviewEdits).some(Boolean);
  if (cv.isPending) return <Loading />;
  if (!cv.data)
    return (
      <>
        <ErrorNotice error={cv.error} />
        <Button onClick={() => cv.refetch()}>Retry</Button>
      </>
    );
  const data = cv.data;
  const latest = data.revisions[0];
  const selectedApplication = applications.data?.find(
    (a) => a.id === selectedApplicationId,
  );
  const tailoringBusy = action.isPending || createForRole.isPending || aiBusy;
  const tailoringBlocker = settings.isPending
    ? "Checking the AI connection…"
    : settings.error
      ? "The AI connection could not be checked. Refresh to try again."
      : !settings.data?.aiConfigured
        ? "Connect your OpenAI key to enable AI tailoring."
        : formDirty
          ? panel === "letter"
            ? "Save or discard your cover letter edits before tailoring."
            : panel === "assistant"
              ? "Send or clear your AI message before tailoring."
              : "Save your content edits before tailoring."
          : hasReviewEdits
            ? "Accept or discard your wording edits before tailoring."
            : !data.applicationId && !selectedApplication
              ? "Choose a saved job posting before tailoring."
              : null;
  return (
    <>
      <Link
        href="/cvs"
        className="mb-6 inline-flex min-h-control items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        All CVs
      </Link>
      <PageHeader
        eyebrow="ATS Classic / Your CV"
        title={data.title}
        description={`Revision ${data.currentRevision}. AI tailoring fills two full pages. Every saved change creates a new version.`}
        action={<Downloads id={id} revision={data.currentRevision} />}
      />
      <ErrorNotice
        error={
          cv.error || action.error || createForRole.error || settings.error
        }
      />
      {latest.reason.startsWith("AI ") && (
        <p
          role="status"
          className="mb-6 rounded-control border border-border bg-accent p-4 text-sm leading-relaxed text-primary"
        >
          AI updated this CV and verified it fits within two pages. Review the
          wording before sending. Earlier versions are preserved in Version
          history; AI changes are listed in Review changes.
        </p>
      )}
      {!data.applicationId && (
        <Panel className="mb-6">
          <h2 className="mb-2 font-semibold">Choose a role for this CV</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            This is a general CV. Select a saved job posting to create a
            separate, AI-tailored version that fills two pages.
          </p>
          <Field label="Job posting for tailoring">
            <Select
              value={selectedApplicationId}
              onChange={(event) => setSelectedApplicationId(event.target.value)}
              disabled={applications.isPending || tailoringBusy}
            >
              <option value="">
                {applications.isPending
                  ? "Loading saved roles…"
                  : "Choose a saved role"}
              </option>
              {applications.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.role} — {a.company}
                </option>
              ))}
            </Select>
          </Field>
          <ErrorNotice error={applications.error} />
          <Link
            href="/applications"
            className="mt-3 inline-flex min-h-control items-center text-sm font-medium text-primary"
          >
            Add or manage job postings →
          </Link>
        </Panel>
      )}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1 rounded-control border border-border bg-card p-1">
          {(
            [
              "preview",
              "edit",
              "review",
              "letter",
              "personas",
              "assistant",
            ] as const
          ).map((tab) => (
            <Button
              key={tab}
              variant="quiet"
              disabled={tailoringBusy || save.isPending}
              aria-pressed={panel === tab}
              className={panel === tab ? "bg-accent text-primary" : ""}
              onClick={() => {
                if (
                  (!formDirty && !hasReviewEdits) ||
                  confirm("Discard unsaved document edits?")
                )
                  setPanel(tab);
              }}
            >
              {tab === "preview"
                ? "Preview"
                : tab === "edit"
                  ? "Edit content"
                  : tab === "letter"
                    ? "Cover letter"
                    : tab === "personas"
                      ? "AI reviewers"
                      : tab === "assistant"
                        ? "AI assistant"
                        : `Review changes${data.suggestions.filter((s) => s.status === "pending").length ? ` (${data.suggestions.filter((s) => s.status === "pending").length})` : ""}`}
            </Button>
          ))}
        </div>
        <Button
          busy={tailoringBusy}
          disabled={Boolean(tailoringBlocker) || save.isPending}
          aria-describedby={tailoringBlocker ? "tailoring-blocker" : undefined}
          onClick={async () => {
            try {
              if (data.applicationId) {
                await action.mutateAsync({ id, action: "tailor" });
                setPanel("review");
              } else if (selectedApplication) {
                const tailored = await createForRole.mutateAsync({
                  id: selectedApplication.id,
                  baseCvId: id,
                  postingRevision: selectedApplication.postingRevision,
                });
                router.push(`/cvs/${tailored.id}`);
              }
            } catch {}
          }}
        >
          <Sparkles size={16} aria-hidden="true" />
          {createForRole.isPending
            ? "Tailoring to two pages…"
            : action.isPending && action.variables?.action === "tailor"
              ? "Preparing suggestions…"
              : "Tailor for this role"}
        </Button>
      </div>
      {tailoringBlocker && (
        <p
          id="tailoring-blocker"
          role="status"
          className="mb-6 text-sm text-muted-foreground"
        >
          {tailoringBlocker}
        </p>
      )}
      {settings.data && !settings.data.aiConfigured && (
        <p className="mb-6 rounded-control border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
          AI tailoring is ready to connect. Add your OpenAI key locally and
          restart the app. You can edit and export your CV now.
        </p>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {panel === "letter" && (
            <CoverLetterPanel cv={data} onDirtyChange={setFormDirty} />
          )}
          {panel === "personas" && (
            <PersonaReviews
              cv={data}
              onBusyChange={setAiBusy}
              onPreview={() => setPanel("preview")}
            />
          )}
          {panel === "assistant" && (
            <CvAssistant
              cv={data}
              onBusyChange={setAiBusy}
              onDirtyChange={setFormDirty}
            />
          )}
          {panel === "preview" && (
            <CvPreview
              id={id}
              revision={data.currentRevision}
              content={latest.content}
            />
          )}
          {panel === "edit" && (
            <fieldset disabled={tailoringBusy} className="min-w-0">
              <DocumentForm
                onDirtyChange={setFormDirty}
                key={id}
                initial={latest.content}
                revision={data.currentRevision}
                pending={save.isPending}
                error={save.error}
                onSave={async (content, revision) => {
                  const result = await save.mutateAsync({
                    id,
                    content,
                    revision,
                  });
                  return {
                    content: result.revisions[0].content,
                    revision: result.currentRevision,
                  };
                }}
              />
            </fieldset>
          )}
          {panel === "review" && (
            <div className="space-y-5">
              {data.suggestions.some((s) => s.status === "pending") && (
                <>
                  <ProposalPreview cv={data} />
                  <Button
                    busy={action.isPending}
                    disabled={hasReviewEdits}
                    onClick={async () => {
                      try {
                        await action.mutateAsync({
                          id,
                          action: "accept-all",
                          revision: data.currentRevision,
                        });
                        setPanel("preview");
                      } catch {}
                    }}
                  >
                    Accept all proposed changes
                  </Button>
                  {hasReviewEdits && (
                    <p className="text-sm text-muted-foreground">
                      Accept your edited wording individually before accepting
                      the remaining changes together.
                    </p>
                  )}
                </>
              )}
              {data.suggestions.length ? (
                data.suggestions.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    cv={data}
                    onEdited={onEdited}
                  />
                ))
              ) : (
                <Empty
                  title="Every change gets your say."
                  description="Tailor this CV to get evidence-backed suggestions. Review the original, proposed wording, and supporting facts before accepting."
                />
              )}
            </div>
          )}
        </div>
        <aside className="space-y-5">
          <Panel>
            <h2 className="font-semibold">A consistent first impression.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Single column. Clear sections. Your contact details in the body.
              No graphics or hidden keywords.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>US Letter</Badge>
              <Badge>PDF + DOCX</Badge>
            </div>
          </Panel>
          <Panel>
            <h2 className="font-semibold">Ready for the role?</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Check document structure and see which job requirements your
              accepted CV supports.
            </p>
            <a
              href="#assessment"
              className={`${buttonClass} mt-3 -ml-4 text-primary`}
            >
              Check alignment <RowArrow />
            </a>
            {data.applicationId && (
              <Link
                href={`/applications/${data.applicationId}`}
                className="block min-h-control py-3 text-sm font-medium text-primary"
              >
                View application →
              </Link>
            )}
          </Panel>
          <Panel>
            <h2 className="mb-3 font-semibold">Version history</h2>
            <ul className="space-y-4">
              {data.revisions.map((r) => (
                <li key={r.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      Revision {r.number}
                    </span>
                    {r.number === data.currentRevision ? (
                      <Badge tone="good">Current</Badge>
                    ) : (
                      <Button
                        variant="quiet"
                        disabled={action.isPending || panel === "edit"}
                        onClick={() =>
                          action.mutate({
                            id,
                            action: "restore",
                            revision: data.currentRevision,
                            number: r.number,
                          })
                        }
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {r.reason}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
      <div id="assessment" className="mt-10 scroll-mt-6">
        <AssessmentPanel
          cv={data}
          onBusyChange={setAiBusy}
          onDiscuss={() => {
            if (
              (formDirty || hasReviewEdits) &&
              !confirm("Discard unsaved document edits?")
            )
              return;
            setPanel("assistant");
            requestAnimationFrame(() => {
              const panel = document.getElementById("cv-assistant-panel");
              panel?.focus({ preventScroll: true });
              panel?.scrollIntoView({ block: "start" });
            });
          }}
        />
      </div>
    </>
  );
}
export function CvDetail() {
  const { id } = useParams<{ id: string }>();
  return (
    <ReviewProvider key={id}>
      <CvWorkspace id={id} />
    </ReviewProvider>
  );
}
