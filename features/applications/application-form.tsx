"use client";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import {
  applicationInputSchema,
  statuses,
  type Application,
  type ApplicationInput,
  type Cv,
} from "@/lib/contracts";
import { queries } from "@/lib/queries";
import { useApplicationActions, useCvActions } from "@/lib/use-actions";
import { useUnsavedChanges } from "@/components/document-form";
import {
  Button,
  ErrorNotice,
  Field,
  Input,
  Panel,
  Saved,
  Select,
  Textarea,
} from "@/components/ui";
import { blankApplication, exampleApplication } from "./example";

export function ApplicationForm({
  initial,
  onCreated,
  onClose,
}: {
  initial?: Application;
  onCreated?: (app: Application, cv?: Cv) => void;
  onClose?: () => void;
}) {
  const form = useForm<ApplicationInput>({
    resolver: zodResolver(applicationInputSchema),
    defaultValues: initial || blankApplication,
  });
  const requirements = useFieldArray({
    control: form.control,
    name: "requirements",
    keyName: "fieldKey",
  });
  const { save, analyze } = useApplicationActions();
  const { createForRole } = useCvActions();
  const settings = useQuery(queries.settings.detail);
  const cvs = useQuery(queries.cvs.list);
  const [savedId, setSavedId] = useState(initial?.id);
  const [autoTailor, setAutoTailor] = useState(true);
  const [baseCvId, setBaseCvId] = useState("");
  const [revision, setRevision] = useState(initial?.revision || 0);
  const [saved, setSaved] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const workMode = useWatch({ control: form.control, name: "workMode" });
  const busy = save.isPending || analyze.isPending || createForRole.isPending;
  useUnsavedChanges(form.formState.isDirty);
  return (
    <Panel>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {initial ? "Application details" : "Add a job opportunity"}
        </h2>
        {!initial && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (
                !form.formState.isDirty ||
                confirm("Replace this draft with the banking job example?")
              )
                form.reset(exampleApplication, { keepDefaultValues: true });
            }}
          >
            Use banking example
          </Button>
        )}
      </div>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          void form.handleSubmit(async (data) => {
            try {
              const result = await save.mutateAsync({
                ...data,
                id: savedId,
                revision,
              });
              form.reset(result);
              setSavedId(result.id);
              setRevision(result.revision);
              setSaved(true);
              const cv =
                !initial && autoTailor
                  ? await createForRole.mutateAsync({
                      id: result.id,
                      baseCvId: baseCvId || null,
                      postingRevision: result.postingRevision,
                    })
                  : undefined;
              if (mounted.current) onCreated?.(result, cv);
            } catch {}
          })(event);
        }}
      >
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Company"
              error={form.formState.errors.company?.message}
            >
              <Input {...form.register("company")} placeholder="Company name" />
            </Field>
            <Field label="Role" error={form.formState.errors.role?.message}>
              <Input
                {...form.register("role")}
                placeholder="e.g. Frontend Engineer"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Work arrangement">
              <Select {...form.register("workMode")}>
                <option value="">Not specified</option>
                <option>Remote</option>
                <option>On-site</option>
                <option>Hybrid</option>
              </Select>
            </Field>
            {workMode !== "Remote" ? (
              <Field
                label="Job location"
                hint="City and country for onsite or hybrid roles."
              >
                <Input
                  {...form.register("location")}
                  placeholder="e.g. Jakarta, Indonesia"
                />
              </Field>
            ) : (
              <p className="self-center text-sm text-muted-foreground">
                Remote role — location is not required.
              </p>
            )}
          </div>
          <Field
            label="Job posting"
            error={form.formState.errors.posting?.message}
            hint="Paste the full description. CVRaga does not fetch job URLs."
          >
            <Textarea rows={10} {...form.register("posting")} />
          </Field>
          <Field
            label="Job URL (optional)"
            error={form.formState.errors.url?.message}
          >
            <Input
              type="url"
              {...form.register("url")}
              placeholder="https://…"
            />
          </Field>
          <div className="border-t border-border pt-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Job requirements</h3>
              {initial && (
                <Button
                  variant="secondary"
                  busy={analyze.isPending}
                  disabled={
                    !settings.data?.aiConfigured || form.formState.isDirty
                  }
                  onClick={async () => {
                    try {
                      const data = await analyze.mutateAsync(initial.id);
                      form.reset(data);
                      setRevision(data.revision);
                    } catch {}
                  }}
                >
                  <Sparkles size={15} aria-hidden="true" />
                  Extract from saved posting
                </Button>
              )}
            </div>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              Review the criteria before scoring. Add them manually, use the
              example, or save and extract with AI. Save edits before extracting
              again.
            </p>
            <div className="space-y-4">
              {requirements.fields.map((r, index) => (
                <div
                  key={r.fieldKey}
                  className="flex flex-wrap items-end gap-2 rounded-control bg-background p-3"
                >
                  <div className="min-w-0 flex-1 basis-52">
                    <Field
                      label={`Requirement ${index + 1}`}
                      error={
                        form.formState.errors.requirements?.[index]?.text
                          ?.message
                      }
                    >
                      <Input {...form.register(`requirements.${index}.text`)} />
                    </Field>
                  </div>
                  <div className="w-40">
                    <Field label="Importance">
                      <Select {...form.register(`requirements.${index}.group`)}>
                        <option value="required">Required</option>
                        <option value="responsibility">Responsibility</option>
                        <option value="preferred">Preferred</option>
                      </Select>
                    </Field>
                  </div>
                  <Button
                    variant="quiet"
                    aria-label={`Remove requirement ${index + 1}`}
                    onClick={() => requirements.remove(index)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="quiet"
              className="mt-2 -ml-3"
              onClick={() =>
                requirements.append({
                  id: crypto.randomUUID(),
                  text: "",
                  group: "required",
                })
              }
            >
              <Plus size={16} aria-hidden="true" />
              Add requirement
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Application status">
              <Select {...form.register("status")}>
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field
              label="Applied date"
              error={form.formState.errors.appliedDate?.message}
            >
              <Input type="date" {...form.register("appliedDate")} />
            </Field>
            <Field
              label="Next action date"
              error={form.formState.errors.nextActionDate?.message}
            >
              <Input type="date" {...form.register("nextActionDate")} />
            </Field>
          </div>
          {initial && (
            <Field
              label="Submitted CV revision"
              hint="Record the exact version you sent. Later edits create separate revisions."
            >
              <Select
                {...form.register("submittedRevisionId", {
                  setValueAs: (v) => v || null,
                })}
              >
                <option value="">Not recorded</option>
                {cvs.data
                  ?.filter((c) => c.applicationId === initial.id)
                  .flatMap((c) =>
                    c.revisions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {c.title} · v{r.number}
                      </option>
                    )),
                  )}
              </Select>
            </Field>
          )}
          <Field label="Notes">
            <Textarea
              rows={3}
              {...form.register("notes")}
              placeholder="Recruiter details, next steps, or interview notes."
            />
          </Field>
          {!initial && (
            <div className="space-y-4 rounded-control border border-border bg-background p-4">
              <label className="flex min-h-control cursor-pointer items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={autoTailor}
                  onChange={(e) => setAutoTailor(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Automatically tailor a CV (maximum 2 pages)
              </label>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Save the role, then let AI tailor and shorten a separate CV to
                fit the posting. Preview the actual PDF pages and review the
                wording. Your source CV stays in version history.
              </p>
              {autoTailor && (
                <Field label="CV source">
                  <Select
                    value={baseCvId}
                    onChange={(e) => setBaseCvId(e.target.value)}
                  >
                    <option value="">Confirmed career details</option>
                    {cvs.data?.map((cv) => (
                      <option key={cv.id} value={cv.id}>
                        {cv.title} · v{cv.currentRevision}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {autoTailor && settings.data && !settings.data.aiConfigured && (
                <p className="text-sm text-muted-foreground">
                  Add your OpenAI key to use automatic tailoring, or uncheck
                  this option to save the opportunity only.
                </p>
              )}
            </div>
          )}
          {Object.keys(form.formState.errors).length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              Review the highlighted fields before saving.
            </p>
          )}
          <ErrorNotice
            error={save.error || analyze.error || createForRole.error}
          />
          {saved && createForRole.error && (
            <p role="status" className="text-sm text-muted-foreground">
              Your opportunity is saved. Retry tailoring below; it will reuse
              this opportunity.
            </p>
          )}
          {createForRole.isPending && (
            <p role="status" className="text-sm text-primary">
              AI is tailoring and shortening your CV, then checking the PDF fits
              within two pages…
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" busy={busy}>
              {initial
                ? "Save application"
                : autoTailor
                  ? savedId
                    ? "Retry tailoring"
                    : "Save & tailor CV"
                  : "Save opportunity"}
            </Button>
            {onClose && (
              <Button
                variant="quiet"
                onClick={() => {
                  if (
                    !form.formState.isDirty ||
                    confirm("Discard this application draft?")
                  )
                    onClose();
                }}
              >
                Cancel
              </Button>
            )}
            <Saved show={saved && !form.formState.isDirty} />
          </div>
        </fieldset>
      </form>
    </Panel>
  );
}
