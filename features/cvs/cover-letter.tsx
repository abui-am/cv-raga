"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { type Cv } from "@/lib/contracts";
import { queries } from "@/lib/queries";
import { useCvActions } from "@/lib/use-actions";
import { useUnsavedChanges } from "@/components/document-form";
import {
  Badge,
  Button,
  ErrorNotice,
  Field,
  Input,
  Panel,
  Textarea,
  buttonClass,
} from "@/components/ui";

const schema = z.object({
  recipient: z.string().min(1).max(500),
  subject: z.string().min(1).max(500),
  body: z.string().trim().min(1),
  closing: z.string().min(1).max(500),
});
function LetterEditor({
  cv,
  postingRevision,
  onDirty,
}: {
  cv: Cv;
  postingRevision: number;
  onDirty: (dirty: boolean) => void;
}) {
  const { saveLetter } = useCvActions();
  const letter = cv.coverLetters[0];
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      recipient: letter?.content.recipient || "Dear Hiring Manager,",
      subject: letter?.content.subject || `Application — ${cv.title}`,
      body: letter?.content.paragraphs.join("\n\n") || "",
      closing: letter?.content.closing || "Sincerely,",
    },
  });
  const [baseNumber, setBaseNumber] = useState(letter?.number || 0);
  useUnsavedChanges(form.formState.isDirty);
  return (
    <form
      className="space-y-5"
      onChange={() => onDirty(true)}
      onSubmit={form.handleSubmit(async (data) => {
        try {
          const saved = await saveLetter.mutateAsync({
            id: cv.id,
            baseNumber,
            cvRevision: cv.currentRevision,
            postingRevision,
            content: {
              recipient: data.recipient,
              subject: data.subject,
              paragraphs: data.body
                .split(/\n\s*\n/)
                .map((p) => p.trim())
                .filter(Boolean),
              closing: data.closing,
            },
          });
          const current = saved.coverLetters[0];
          setBaseNumber(current.number);
          form.reset({
            ...data,
            body: current.content.paragraphs.join("\n\n"),
          });
          onDirty(false);
        } catch {}
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Letter recipient"
          error={form.formState.errors.recipient?.message}
        >
          <Input {...form.register("recipient")} />
        </Field>
        <Field
          label="Letter subject"
          error={form.formState.errors.subject?.message}
        >
          <Input {...form.register("subject")} />
        </Field>
      </div>
      <Field
        label="Cover letter"
        hint="Separate paragraphs with a blank line. Keep it concise: up to 450 words. Confirm every claim before saving."
        error={form.formState.errors.body?.message}
      >
        <Textarea rows={17} {...form.register("body")} />
      </Field>
      <Field label="Closing">
        <Input {...form.register("closing")} />
      </Field>
      <ErrorNotice error={saveLetter.error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" busy={saveLetter.isPending}>
          Save & confirm letter
        </Button>
        {saveLetter.isSuccess && !form.formState.isDirty && (
          <span role="status" className="text-sm text-primary">
            Cover letter saved and confirmed.
          </span>
        )}
      </div>
    </form>
  );
}
export function CoverLetterPanel({
  cv,
  onDirtyChange,
}: {
  cv: Cv;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const app = useQuery({
    ...queries.applications.detail(cv.applicationId || "none"),
    enabled: Boolean(cv.applicationId),
  });
  const settings = useQuery(queries.settings.detail);
  const { action } = useCvActions();
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const latest = cv.coverLetters[0];
  const accepted = cv.coverLetters.find(
    (l) => l.status === "accepted" && !l.stale,
  );
  return (
    <Panel>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Your tailored cover letter</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A separate introduction to this role, grounded in your accepted CV.
          </p>
        </div>
        <Button
          busy={action.isPending}
          disabled={!cv.applicationId || !settings.data?.aiConfigured || dirty}
          onClick={() =>
            action.mutate({ id: cv.id, action: "letter-generate" })
          }
        >
          <Sparkles size={15} aria-hidden="true" />
          {latest ? "Generate a new draft" : "Generate cover letter"}
        </Button>
      </div>
      {!cv.applicationId ? (
        <p className="text-sm text-muted-foreground">
          Create this CV from an application to tailor a letter to its job
          posting.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge>CV v{cv.currentRevision}</Badge>
            <Badge>Job v{app.data?.postingRevision || "…"}</Badge>
            {latest && (
              <Badge
                tone={
                  latest.status === "accepted" && !latest.stale
                    ? "good"
                    : "warning"
                }
              >
                Letter v{latest.number} ·{" "}
                {latest.stale ? "Needs updating" : latest.status}
              </Badge>
            )}
          </div>
          {latest?.stale && (
            <p className="mb-5 rounded-control bg-warning p-4 text-sm text-warning-foreground">
              The CV or job changed. Update the letter and confirm it for the
              current revisions.
            </p>
          )}
          {dirty && (
            <p className="mb-4 text-xs text-muted-foreground">
              Save your edits before generating another draft.
            </p>
          )}
          <ErrorNotice error={action.error || app.error} />
          {app.data && (
            <LetterEditor
              key={latest?.id || "new-letter"}
              cv={cv}
              postingRevision={app.data.postingRevision}
              onDirty={setDirty}
            />
          )}
          {accepted && (
            <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
              <a
                className={`${buttonClass} border border-border`}
                href={`/api/cvs/${cv.id}/letter-export?letterId=${accepted.id}&format=pdf`}
                download
              >
                Download letter PDF
              </a>
              <a
                className={`${buttonClass} border border-border`}
                href={`/api/cvs/${cv.id}/letter-export?letterId=${accepted.id}&format=docx`}
                download
              >
                Download letter DOCX
              </a>
            </div>
          )}
          {latest?.evidenceQuotes.length ? (
            <details className="mt-4">
              <summary className="min-h-control py-3 text-sm font-medium text-primary">
                Supporting CV quotes
              </summary>
              {latest.evidenceQuotes.map((quote, i) => (
                <blockquote
                  key={i}
                  className="mb-3 border-l-2 border-border pl-3 text-sm leading-relaxed"
                >
                  {quote}
                </blockquote>
              ))}
            </details>
          ) : null}
        </>
      )}
    </Panel>
  );
}
