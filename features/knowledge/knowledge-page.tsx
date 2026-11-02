"use client";
import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Check, Trash2 } from "lucide-react";
import {
  evidenceInputSchema,
  type Evidence,
  type EvidenceInput,
  type OpenQuestion,
  type Source,
} from "@/lib/contracts";
import { queries } from "@/lib/queries";
import { ApiError } from "@/lib/http";
import { useDeleteEvidence, useSaveEvidence } from "@/lib/use-actions";
import { knowledgeApi } from "./api";
import { useUnsavedChanges } from "@/components/document-form";
import { careerEntries } from "@/lib/career";
import {
  Badge,
  Button,
  Empty,
  ErrorNotice,
  Field,
  Input,
  Loading,
  Panel,
  Saved,
  Select,
  Textarea,
} from "@/components/ui";

const evidenceKinds = [
  "Project",
  "Achievement",
  "Responsibility",
  "Certification",
  "Note",
] as const;
type AnswerNotice = { tone: "good" | "warning" | "error"; text: string };

function EvidenceForm({
  initial,
  source,
  onDone,
  onSaved,
  careerEntryId,
  onDirtyChange,
  modal = false,
}: {
  initial?: Evidence;
  careerEntryId?: string;
  onDirtyChange: (dirty: boolean) => void;
  source?: Source;
  onDone: () => void;
  onSaved: (id: string) => void;
  modal?: boolean;
}) {
  const save = useSaveEvidence();
  const profile = useQuery(queries.profile.detail);
  const entries = profile.data ? careerEntries(profile.data.content) : [];
  const form = useForm<EvidenceInput>({
    resolver: zodResolver(evidenceInputSchema),
    defaultValues: initial || {
      title: source?.name || "",
      kind: "Note",
      text: source?.text || "",
      tags: [],
      confirmed: false,
      sourceId: source?.id || null,
      careerEntryId: careerEntryId || null,
    },
  });
  const [revision, setRevision] = useState(initial?.revision || 0);
  const [recordId, setRecordId] = useState(initial?.id);
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    if (modal) {
      element?.showModal();
      document.body.style.overflow = "hidden";
    }
    heading.current?.focus({ preventScroll: true });
    if (!modal) heading.current?.scrollIntoView({ block: "start" });
    return () => {
      if (modal) {
        element?.close();
        document.body.style.overflow = overflow;
      }
    };
  }, [modal]);
  useUnsavedChanges(form.formState.isDirty);
  useEffect(() => {
    onDirtyChange(form.formState.isDirty);
    return () => onDirtyChange(false);
  }, [form.formState.isDirty, onDirtyChange]);
  const close = () => {
    if (save.isPending) return;
    if (!form.formState.isDirty || confirm("Discard unsaved evidence changes?"))
      onDone();
  };
  const content = (
    <>
      <div
        className={`flex shrink-0 flex-wrap items-center justify-between gap-3 ${modal ? "border-b border-border px-5 py-4 sm:px-6" : "mb-5"}`}
      >
        <h2
          id={headingId}
          ref={heading}
          tabIndex={-1}
          className="scroll-mt-6 text-lg font-semibold"
        >
          {recordId ? "Edit career evidence" : "Add career evidence"}
        </h2>
        <Button variant="quiet" disabled={save.isPending} onClick={close}>
          Close
        </Button>
      </div>
      <form
        className={`space-y-5 ${modal ? "min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6" : ""}`}
        onSubmit={form.handleSubmit(async (data) => {
          try {
            const result = await save.mutateAsync({
              ...data,
              tags: data.tags.map((t) => t.trim()).filter(Boolean),
              id: recordId,
              revision,
            });
            form.reset(result);
            setRevision(result.revision);
            setRecordId(result.id);
            onSaved(result.id);
          } catch {}
        })}
      >
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Title" error={form.formState.errors.title?.message}>
            <Input
              {...form.register("title")}
              placeholder="e.g. Led a frontend migration"
            />
          </Field>
          <Field label="Type">
            <Select {...form.register("kind")}>
              {evidenceKinds.map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Controller
          control={form.control}
          name="careerEntryId"
          render={({ field }) => (
            <Field
              label="Related career entry"
              hint="Add detail to an existing role, project, or education entry, or keep this as general evidence."
            >
              <Select
                value={field.value || ""}
                onChange={(event) => field.onChange(event.target.value || null)}
              >
                <option value="">General career evidence</option>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        />
        <Field
          label="What happened, and what did you contribute?"
          hint="Include context, your role, the outcome, and only numbers you can verify."
          error={form.formState.errors.text?.message}
        >
          <Textarea rows={8} {...form.register("text")} />
        </Field>
        <Controller
          control={form.control}
          name="tags"
          render={({ field }) => (
            <Field
              label="Tags"
              hint="Separate tags with commas, e.g. React, testing, leadership."
            >
              <Input
                {...field}
                value={field.value.join(",")}
                onChange={(e) => field.onChange(e.target.value.split(","))}
              />
            </Field>
          )}
        />
        {source && (
          <p className="text-xs text-muted-foreground">
            Source: {source.name}. Read and verify the imported text before
            confirming.
          </p>
        )}
        <label className="flex min-h-control cursor-pointer items-start gap-3 rounded-control bg-accent p-4">
          <input
            type="checkbox"
            className="mt-1 size-4"
            {...form.register("confirmed")}
          />
          <span className="text-sm">
            <strong className="font-semibold">
              I confirm this is accurate
            </strong>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              Only confirmed evidence can support AI tailoring. Drafts stay in
              your library.
            </span>
          </span>
        </label>
        <ErrorNotice error={save.error} />
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" busy={save.isPending}>
            Save evidence
          </Button>
          <Saved show={save.isSuccess && !form.formState.isDirty} />
        </div>
      </form>
    </>
  );
  return modal ? (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-panel border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-foreground/30 open:flex open:flex-col"
    >
      {content}
    </dialog>
  ) : (
    <Panel>{content}</Panel>
  );
}

function AnswerForm({
  question,
  onDirtyChange,
  onDiscard,
  onFinished,
}: {
  question: OpenQuestion;
  onDirtyChange: (dirty: boolean) => void;
  onDiscard: () => void;
  onFinished: (questionId: string, notice: AnswerNotice) => void;
}) {
  const client = useQueryClient();
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const form = useForm<Pick<EvidenceInput, "kind" | "text">>({
    resolver: zodResolver(evidenceInputSchema.pick({ kind: true, text: true })),
    defaultValues: { kind: "Note", text: "" },
  });
  const textField = form.register("text");
  useEffect(() => {
    answerRef.current?.focus();
  }, []);
  useUnsavedChanges(form.formState.isDirty);
  useEffect(() => {
    onDirtyChange(form.formState.isDirty);
    return () => onDirtyChange(false);
  }, [form.formState.isDirty, onDirtyChange]);
  const discard = () => {
    if (pending) return;
    if (form.formState.isDirty && !confirm("Discard unsaved evidence changes?"))
      return;
    onDiscard();
  };
  return (
    <form
      className="mt-4 space-y-4 border-t border-border pt-4"
      onSubmit={form.handleSubmit(async (data) => {
        if (pending) return;
        setPending(true);
        setError(null);
        try {
          const saved = await knowledgeApi.save({
            title: question.question.slice(0, 500),
            kind: data.kind,
            text: data.text,
            tags: [],
            confirmed: true,
            sourceId: null,
            careerEntryId: null,
            revision: 0,
            openQuestionId: question.id,
          });
          client.setQueryData(
            queries.knowledge.detail(saved.id).queryKey,
            saved,
          );
          onFinished(question.id, {
            tone: "good",
            text: "Answer saved as confirmed evidence in your private workspace.",
          });
          await client.invalidateQueries({
            queryKey: queries.knowledge._def,
          });
        } catch (saveError) {
          if (saveError instanceof ApiError && saveError.status === 404) {
            onFinished(question.id, {
              tone: "error",
              text: saveError.message,
            });
            await client.invalidateQueries({
              queryKey: queries.knowledge.open.queryKey,
            });
            return;
          }
          setError(
            saveError instanceof Error
              ? saveError
              : new Error("The answer could not be saved."),
          );
        } finally {
          setPending(false);
        }
      })}
    >
      <Field label="Type">
        <Select {...form.register("kind")}>
          {evidenceKinds.map((kind) => (
            <option key={kind}>{kind}</option>
          ))}
        </Select>
      </Field>
      <Field
        label="Your answer"
        hint="Saving confirms this answer as career evidence."
        error={form.formState.errors.text?.message}
      >
        <Textarea
          rows={8}
          {...textField}
          ref={(node) => {
            textField.ref(node);
            answerRef.current = node;
          }}
        />
      </Field>
      <ErrorNotice error={error} />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" busy={pending}>
          {pending ? "Saving answer…" : "Save answer"}
        </Button>
        <Button variant="quiet" disabled={pending} onClick={discard}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function EvidenceLibrary({
  initialSource,
  initialCareerEntryId,
  onDirtyChange,
}: {
  initialSource?: Source;
  initialCareerEntryId?: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const profile = useQuery(queries.profile.detail);
  const entries = profile.data ? careerEntries(profile.data.content) : [];
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const evidence = useQuery(queries.knowledge.list(deferred));
  const openQuestions = useQuery(queries.knowledge.open);
  const [edit, setEdit] = useState<{
    id: string;
    key: string;
    modal?: boolean;
  } | null>(
    initialSource || initialCareerEntryId ? { id: "", key: "requested" } : null,
  );
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [closedIds, setClosedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<AnswerNotice | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const focusNotice = useRef(false);
  const [source, setSource] = useState<Source | undefined>(initialSource);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!focusNotice.current || !notice) return;
    noticeRef.current?.focus();
    focusNotice.current = false;
  }, [notice]);
  const showNotice = (questionId: string, next: AnswerNotice) => {
    focusNotice.current = true;
    setNotice(next);
    setClosedIds((current) =>
      current.includes(questionId) ? current : [...current, questionId],
    );
    setAnsweringId((current) => (current === questionId ? null : current));
  };
  const selected = evidence.data?.find((e) => e.id === edit?.id);
  const visibleQuestions =
    openQuestions.data?.filter(
      (question) => !closedIds.includes(question.id),
    ) ?? [];
  const remove = useDeleteEvidence();
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-reading">
          <h2 className="text-xl font-semibold">Supporting evidence</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Keep the context, outcomes, and source material behind your career
            history. Add details here; edit shared career facts in Career
            history.
          </p>
        </div>
        <Button
          onClick={(event) => {
            if (dirty && !confirm("Discard unsaved evidence changes?")) return;
            opener.current = event.currentTarget;
            setAnsweringId(null);
            setEdit({ id: "", key: `new-${Date.now()}` });
            setSource(undefined);
          }}
        >
          <Plus size={16} aria-hidden="true" />
          Add evidence
        </Button>
      </div>
      {edit && (
        <div className={edit.modal ? undefined : "mb-8"}>
          <EvidenceForm
            key={edit.key}
            modal={edit.modal}
            initial={selected}
            onDirtyChange={setDirty}
            source={source}
            careerEntryId={
              edit.key === "requested" ? initialCareerEntryId : undefined
            }
            onDone={() => {
              setEdit(null);
              requestAnimationFrame(() => opener.current?.focus());
            }}
            onSaved={(id) =>
              setEdit((current) =>
                current?.key === edit.key ? { ...current, id } : current,
              )
            }
          />
        </div>
      )}
      {notice && (
        <p
          ref={noticeRef}
          tabIndex={-1}
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mb-8 rounded-control p-4 text-sm leading-relaxed outline-none ${notice.tone === "good" ? "bg-accent text-primary" : notice.tone === "warning" ? "bg-warning text-warning-foreground" : "bg-destructive/10 text-destructive"}`}
        >
          {notice.text}
        </p>
      )}
      {openQuestions.isPending ? (
        <div className="mb-8">
          <Loading label="Loading questions without evidence…" />
        </div>
      ) : openQuestions.isError ? (
        <section className="mb-8" aria-labelledby="open-questions">
          <h2 id="open-questions" className="text-lg font-semibold">
            Questions without evidence
          </h2>
          <ErrorNotice error={openQuestions.error} />
          <Button variant="secondary" onClick={() => openQuestions.refetch()}>
            Retry
          </Button>
        </section>
      ) : visibleQuestions.length ? (
        <section className="mb-8" aria-labelledby="open-questions">
          <h2 id="open-questions" className="text-lg font-semibold">
            Questions without evidence
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            These career questions had no related evidence. An answer is saved
            as confirmed career evidence.
          </p>
          <ul className="mt-4 space-y-3">
            {visibleQuestions.map((question) => {
              const open = answeringId === question.id;
              return (
                <li
                  key={question.id}
                  className="rounded-panel border border-border px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Badge tone="neutral">Unsure</Badge>
                      <p className="mt-2 text-base leading-relaxed">
                        {question.question}
                      </p>
                    </div>
                    <Button
                      aria-label={`Answer: ${question.question}`}
                      aria-expanded={open}
                      aria-hidden={open || undefined}
                      tabIndex={open ? -1 : 0}
                      className={open ? "sr-only" : ""}
                      onClick={(event) => {
                        if (
                          dirty &&
                          !confirm("Discard unsaved evidence changes?")
                        )
                          return;
                        opener.current = event.currentTarget;
                        setEdit(null);
                        setSource(undefined);
                        setAnsweringId(question.id);
                      }}
                    >
                      Answer
                    </Button>
                  </div>
                  {open && (
                    <AnswerForm
                      question={question}
                      onDirtyChange={setDirty}
                      onDiscard={() => {
                        setAnsweringId(null);
                        requestAnimationFrame(() => opener.current?.focus());
                      }}
                      onFinished={showNotice}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="evidence-library" className="text-lg font-semibold">
          Your evidence library
        </h2>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search evidence</span>
          <Search
            size={16}
            aria-hidden="true"
            className="absolute top-3.5 left-3 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search evidence…"
            className="pl-10"
          />
        </label>
      </div>
      <ErrorNotice error={evidence.error} />
      <ErrorNotice error={remove.error} />
      {remove.isSuccess && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Evidence deleted from your library.
        </p>
      )}
      {evidence.isPending ? (
        <Loading />
      ) : !evidence.data?.length ? (
        <Empty
          title={
            search ? "No matching evidence" : "Your experience belongs here."
          }
          description={
            search
              ? "Try another search or clear the filter."
              : "Add a project or achievement to start supporting your career history."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {evidence.data.map((item) => (
            <Panel key={item.id}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <Badge>{item.kind}</Badge>
                <Badge tone={item.confirmed ? "good" : "warning"}>
                  {item.confirmed && (
                    <Check size={12} className="mr-1" aria-hidden="true" />
                  )}
                  {item.confirmed ? "Confirmed" : "Draft"}
                </Badge>
              </div>
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-xs font-medium text-primary">
                {entries.find((entry) => entry.id === item.careerEntryId)
                  ?.label || "General career evidence"}
              </p>
              <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {item.text}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {item.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="rounded border border-border px-2 py-1 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="quiet"
                  className="-ml-3"
                  disabled={remove.isPending}
                  onClick={(event) => {
                    if (dirty && !confirm("Discard unsaved evidence changes?"))
                      return;
                    opener.current = event.currentTarget;
                    setAnsweringId(null);
                    setSource(undefined);
                    setEdit({
                      id: item.id,
                      key: `${item.id}-${Date.now()}`,
                      modal: true,
                    });
                  }}
                >
                  Review & edit
                </Button>
                <Button
                  variant="danger"
                  aria-label={`Delete evidence: ${item.title}`}
                  disabled={remove.isPending}
                  busy={remove.isPending && remove.variables.id === item.id}
                  onClick={() => {
                    if (
                      !confirm(
                        `Delete “${item.title}” from your evidence library? This cannot be undone. Saved CVs and source documents will be kept.`,
                      )
                    )
                      return;
                    remove.mutate(
                      { id: item.id, revision: item.revision },
                      {
                        onSuccess: () => {
                          setEdit((current) =>
                            current?.id === item.id ? null : current,
                          );
                        },
                      },
                    );
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Delete
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}
      <div className="mt-8"></div>
      {evidence.isFetching && !evidence.isPending && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          Refreshing evidence…
        </p>
      )}
    </>
  );
}
