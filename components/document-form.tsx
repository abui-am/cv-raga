"use client";
import { useEffect, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { cvContentSchema, type CvContent } from "@/lib/contracts";
import { normalizeDocument } from "@/lib/document";
import { ReorderableList } from "./reorderable-list";
import {
  Button,
  ErrorNotice,
  Field,
  Input,
  Panel,
  Saved,
  Select,
  Textarea,
} from "./ui";

const formSchema = cvContentSchema.extend({
  name: z.string().trim().min(1, "Enter your name").max(500),
  email: z.union([z.literal(""), z.email()]),
});
function Lines({
  control,
  name,
  label,
  hint,
  disabled = false,
}: {
  control: Control<CvContent>;
  name:
    | "skills"
    | "languages"
    | "links"
    | "certifications"
    | `experience.${number}.bullets`
    | `projects.${number}.bullets`;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const values = field.value || [];
        const counts = new Map<string, number>();
        const items = values.map((value) => {
          const occurrence = counts.get(value) || 0;
          counts.set(value, occurrence + 1);
          return { id: JSON.stringify([value, occurrence]), text: value };
        });
        return (
          <div>
            <Field
              label={label}
              hint={hint || "One item per line."}
              error={fieldState.error?.message}
            >
              <Textarea
                {...field}
                disabled={disabled}
                value={values.join("\n")}
                onChange={(e) => field.onChange(e.target.value.split("\n"))}
                rows={name === "links" || name === "languages" ? 2 : 4}
              />
            </Field>
            {items.length > 1 && (
              <details className="mt-2 rounded-control border border-border">
                <summary className="min-h-control cursor-pointer px-3 py-3 text-sm font-medium text-primary">
                  Reorder {label.toLowerCase()} ({items.length})
                </summary>
                <div className="border-t border-border p-2">
                  <ReorderableList
                    items={items}
                    getKey={(item) => item.id}
                    getLabel={(_item, index) => `${label} item ${index + 1}`}
                    label={`${label} order`}
                    disabled={disabled}
                    onMove={(from, to) => {
                      const next = [...values];
                      const [moved] = next.splice(from, 1);
                      next.splice(to, 0, moved);
                      field.onChange(next);
                    }}
                    renderItem={(item, _index, controls) => (
                      <div className="flex items-center gap-2 rounded-control bg-background p-2">
                        <p className="min-w-0 flex-1 line-clamp-3 text-sm leading-relaxed [overflow-wrap:anywhere]">
                          {item.text || "Empty item"}
                        </p>
                        {controls}
                      </div>
                    )}
                  />
                </div>
              </details>
            )}
          </div>
        );
      }}
    />
  );
}
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const navigation = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.("a[href]");
      if (
        anchor &&
        anchor.getAttribute("href")?.startsWith("/") &&
        !anchor.hasAttribute("download") &&
        !window.confirm("Leave this page and discard unsaved changes?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigation, true);
    };
  }, [dirty]);
}
export function DocumentForm({
  initial,
  revision,
  onSave,
  label = "Save changes",
  pending,
  error,
  onDirtyChange,
  careerSection,
  onAddEvidence,
  onCareerSectionChange,
}: {
  initial: CvContent;
  revision: number;
  onSave: (
    content: CvContent,
    revision: number,
  ) => Promise<{ content: CvContent; revision: number }>;
  label?: string;
  pending: boolean;
  error?: Error | null;
  onDirtyChange?: (dirty: boolean) => void;
  careerSection?: "details" | "history";
  onAddEvidence?: (entryId: string) => void;
  onCareerSectionChange?: (section: "details" | "history") => void;
}) {
  const form = useForm<CvContent>({
    resolver: zodResolver(formSchema),
    defaultValues: structuredClone(normalizeDocument(initial)),
  });
  const [baseline, setBaseline] = useState(revision);
  const experience = useFieldArray({
    control: form.control,
    name: "experience",
    keyName: "fieldKey",
  });
  const education = useFieldArray({
    control: form.control,
    name: "education",
    keyName: "fieldKey",
  });
  const projects = useFieldArray({
    control: form.control,
    name: "projects",
    keyName: "fieldKey",
  });
  const [saved, setSaved] = useState(false);
  const watchedExperience = useWatch({
    control: form.control,
    name: "experience",
  });
  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
    return () => onDirtyChange?.(false);
  }, [form.formState.isDirty, onDirtyChange]);
  useUnsavedChanges(form.formState.isDirty);
  return (
    <form
      className="space-y-6"
      onSubmit={form.handleSubmit(
        async (content) => {
          setSaved(false);
          const clean = structuredClone(content);
          clean.skills = clean.skills.map((v) => v.trim()).filter(Boolean);
          if (clean.languages)
            clean.languages = clean.languages
              .map((v) => v.trim())
              .filter(Boolean);
          clean.links = clean.links.map((v) => v.trim()).filter(Boolean);
          clean.certifications = clean.certifications
            .map((v) => v.trim())
            .filter(Boolean);
          clean.experience.forEach((e) => {
            e.bullets = e.bullets.map((v) => v.trim()).filter(Boolean);
          });
          clean.projects.forEach((p) => {
            p.bullets = p.bullets.map((v) => v.trim()).filter(Boolean);
          });
          try {
            const result = await onSave(normalizeDocument(clean), baseline);
            form.reset(result.content);
            setBaseline(result.revision);
            setSaved(true);
          } catch {
            /* Mutation error is rendered below; preserve all input. */
          }
        },
        (errors) => {
          if (onCareerSectionChange)
            onCareerSectionChange(
              errors.name || errors.email ? "details" : "history",
            );
        },
      )}
    >
      <Panel className={careerSection === "history" ? "hidden" : ""}>
        <div className="mb-5">
          <h2 className="text-lg font-semibold">
            {careerSection ? "Personal details" : "The essentials"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact details appear as readable text at the top of your CV.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={form.formState.errors.name?.message}>
            <Input autoComplete="name" {...form.register("name")} />
          </Field>
          <Field label="Professional headline">
            <Input
              {...form.register("headline")}
              placeholder="e.g. Frontend Engineer"
            />
          </Field>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input
              type="email"
              autoComplete="email"
              {...form.register("email")}
            />
          </Field>
          <Field label="Phone">
            <Input type="tel" autoComplete="tel" {...form.register("phone")} />
          </Field>
          <Field label="Location">
            <Input {...form.register("location")} placeholder="City, Country" />
          </Field>
          <Lines
            control={form.control}
            name="links"
            disabled={pending}
            label="Professional links"
            hint="LinkedIn, GitHub or portfolio. One URL per line."
          />
          <div className="sm:col-span-2">
            <Lines
              control={form.control}
              name="languages"
              disabled={pending}
              label="Languages & proficiency"
              hint="One language and level per line, e.g. English — B2 (Upper Intermediate), or Indonesian — Native."
            />
          </div>
        </div>
      </Panel>
      <Panel className={careerSection === "details" ? "hidden" : ""}>
        <h2 className="mb-5 text-lg font-semibold">Your professional story</h2>
        <div className="space-y-5">
          <Field
            label="Professional summary"
            error={form.formState.errors.summary?.message}
          >
            <Textarea
              {...form.register("summary")}
              rows={5}
              placeholder="Your experience, strengths, and the work you do best."
            />
          </Field>
          <Lines
            control={form.control}
            name="skills"
            disabled={pending}
            label="Technical skills"
          />
        </div>
      </Panel>
      <Panel className={careerSection === "details" ? "hidden" : ""}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Professional experience</h2>
          <Button
            variant="secondary"
            onClick={() =>
              experience.append({
                id: crypto.randomUUID(),
                role: "",
                company: "",
                period: "",
                employmentType: "",
                workMode: "",
                location: "",
                bullets: [],
              })
            }
          >
            <Plus size={15} aria-hidden="true" />
            Add role
          </Button>
        </div>
        {!experience.fields.length && (
          <p className="text-sm text-muted-foreground">
            Add roles and the work you can confidently speak to.
          </p>
        )}
        <ReorderableList
          items={experience.fields}
          getKey={(entry) => entry.fieldKey}
          getLabel={(entry, index) =>
            `${entry.role || `Role ${index + 1}`} at ${entry.company || "new employer"}`
          }
          label="Experience entries"
          onMove={experience.move}
          disabled={pending}
          renderItem={(entry, index, controls) => (
            <div
              key={entry.fieldKey}
              className="space-y-4 border-t border-border pt-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Role {index + 1}</h3>
                <div className="flex items-center">
                  {controls}
                  <Button
                    variant="quiet"
                    aria-label={`Remove role ${index + 1}`}
                    onClick={() => experience.remove(index)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Job title">
                  <Input {...form.register(`experience.${index}.role`)} />
                </Field>
                <Field label="Company">
                  <Input {...form.register(`experience.${index}.company`)} />
                </Field>
                <Field label="Dates">
                  <Input
                    {...form.register(`experience.${index}.period`)}
                    placeholder="Apr 2022 – Present"
                  />
                </Field>
                <Field label="Employment type">
                  <Input
                    {...form.register(`experience.${index}.employmentType`)}
                    placeholder="e.g. Full-time, Contract"
                  />
                </Field>
                <Field label="Work arrangement">
                  <Select {...form.register(`experience.${index}.workMode`)}>
                    <option value="">Not specified</option>
                    <option>Remote</option>
                    <option>On-site</option>
                    <option>Hybrid</option>
                  </Select>
                </Field>
                {watchedExperience[index]?.workMode !== "Remote" && (
                  <Field label="Job location">
                    <Input
                      {...form.register(`experience.${index}.location`)}
                      placeholder="e.g. Bandung, Indonesia"
                    />
                  </Field>
                )}
              </div>
              <Lines
                control={form.control}
                name={`experience.${index}.bullets`}
                disabled={pending}
                label="Responsibilities & achievements"
                hint="One bullet per line. Include only facts you can support."
              />
              {onAddEvidence && (
                <Button
                  variant="quiet"
                  disabled={form.formState.isDirty || pending}
                  onClick={() => onAddEvidence(`experience:${entry.id}`)}
                >
                  Add supporting evidence
                </Button>
              )}
            </div>
          )}
        />
      </Panel>
      <Panel className={careerSection === "details" ? "hidden" : ""}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Programs & projects</h2>
          <Button
            variant="secondary"
            onClick={() =>
              projects.append({
                id: crypto.randomUUID(),
                name: "",
                detail: "",
                bullets: [],
              })
            }
          >
            <Plus size={15} aria-hidden="true" />
            Add project
          </Button>
        </div>
        <ReorderableList
          items={projects.fields}
          getKey={(entry) => entry.fieldKey}
          getLabel={(entry, index) => entry.name || `Project ${index + 1}`}
          label="Project entries"
          onMove={projects.move}
          disabled={pending}
          renderItem={(entry, index, controls) => (
            <div
              key={entry.fieldKey}
              className="space-y-4 border-t border-border pt-5"
            >
              <div className="flex items-center justify-end">
                {controls}
                <Button
                  variant="quiet"
                  aria-label={`Remove project ${index + 1}`}
                  onClick={() => projects.remove(index)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project name">
                  <Input {...form.register(`projects.${index}.name`)} />
                </Field>
                <Field label="Context or technologies">
                  <Input {...form.register(`projects.${index}.detail`)} />
                </Field>
              </div>
              <Lines
                control={form.control}
                name={`projects.${index}.bullets`}
                disabled={pending}
                label="Contributions"
              />
              {onAddEvidence && (
                <Button
                  variant="quiet"
                  disabled={form.formState.isDirty || pending}
                  onClick={() => onAddEvidence(`projects:${entry.id}`)}
                >
                  Add supporting evidence
                </Button>
              )}
            </div>
          )}
        />
      </Panel>
      <Panel className={careerSection === "details" ? "hidden" : ""}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Education</h2>
          <Button
            variant="secondary"
            onClick={() =>
              education.append({
                id: crypto.randomUUID(),
                institution: "",
                qualification: "",
                period: "",
              })
            }
          >
            <Plus size={15} aria-hidden="true" />
            Add education
          </Button>
        </div>
        <ReorderableList
          items={education.fields}
          getKey={(entry) => entry.fieldKey}
          getLabel={(entry, index) =>
            entry.institution || `Education ${index + 1}`
          }
          label="Education entries"
          disabled={pending}
          onMove={(from, to) => {
            const next = [...form.getValues("education")];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            education.move(from, to);
            form.setValue(
              "educationOrder",
              next.map((entry) => entry.id),
              { shouldDirty: true },
            );
          }}
          renderItem={(entry, index, controls) => (
            <div
              key={entry.fieldKey}
              className="space-y-4 border-t border-border pt-5"
            >
              <div className="flex items-center justify-end">
                {controls}
                <Button
                  variant="quiet"
                  aria-label={`Remove education ${index + 1}`}
                  onClick={() => education.remove(index)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </div>
              <Field label="Qualification">
                <Input {...form.register(`education.${index}.qualification`)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Institution">
                  <Input {...form.register(`education.${index}.institution`)} />
                </Field>
                <Field label="Dates">
                  <Input {...form.register(`education.${index}.period`)} />
                </Field>
              </div>
              {onAddEvidence && (
                <Button
                  variant="quiet"
                  disabled={form.formState.isDirty || pending}
                  onClick={() => onAddEvidence(`education:${entry.id}`)}
                >
                  Add supporting evidence
                </Button>
              )}
            </div>
          )}
        />
      </Panel>
      <Panel className={careerSection === "details" ? "hidden" : ""}>
        <Lines
          control={form.control}
          name="certifications"
          disabled={pending}
          label="Publications, certifications & awards"
        />
      </Panel>
      {Object.keys(form.formState.errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          Review the highlighted fields. Check nested entries meet the field
          length limits.
        </p>
      )}
      <ErrorNotice error={error} />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" busy={pending}>
          {pending ? "Saving…" : label}
        </Button>
        <Saved show={saved && !form.formState.isDirty} />
        {form.formState.isDirty && (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        )}
      </div>
    </form>
  );
}
