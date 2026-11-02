"use client";
import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
import { z } from "zod";
import type { Cv } from "@/lib/contracts";
import { queries } from "@/lib/queries";
import { useCvActions } from "@/lib/use-actions";
import { useUnsavedChanges } from "@/components/document-form";
import {
  Badge,
  Button,
  ErrorNotice,
  Field,
  Panel,
  Select,
  Textarea,
} from "@/components/ui";
const schema = z.object({
  message: z.string().trim().min(1, "Tell AI what you need.").max(4000),
  mode: z.enum(["refine", "question"]),
  saveKnowledge: z.boolean(),
  perspective: z.enum(["Combined", "HR", "TeamLead", "Management"]),
});
export function CvAssistant({
  cv,
  onDirtyChange,
  onBusyChange,
}: {
  cv: Cv;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { action } = useCvActions();
  const conversation = useRef<HTMLDivElement>(null);
  const settings = useQuery(queries.settings.detail);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      message: "",
      mode: "refine",
      saveKnowledge: true,
      perspective: "Combined",
    },
  });
  const mode = useWatch({ control: form.control, name: "mode" });
  const draft = useWatch({ control: form.control, name: "message" });
  const dirty = Boolean(draft?.trim());
  const match = cv.assessments.find((assessment) => !assessment.stale);
  useEffect(() => {
    const element = conversation.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [cv.messages.length]);
  useUnsavedChanges(dirty);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange(action.isPending);
    return () => onBusyChange(false);
  }, [action.isPending, onBusyChange]);
  return (
    <div id="cv-assistant-panel" tabIndex={-1} className="space-y-5">
      <Panel>
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare
            size={20}
            aria-hidden="true"
            className="text-primary"
          />
          <h2 className="text-xl font-semibold">Your CV assistant</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Discuss your match gaps, answer focused questions, or give editing
          instructions. Your factual answers can update My career and guide a
          new CV revision that fills two full pages using confirmed facts. I use
          your career record first, infer general skills from documented work,
          and ask only for specific evidence still needed.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge>
            {match
              ? `CVRaga Match ${match.score}/100`
              : "No current match score"}
          </Badge>
          <a
            href="#assessment"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Check current match
          </a>
        </div>
      </Panel>
      <div
        ref={conversation}
        className="max-h-[65dvh] space-y-4 overflow-y-auto pr-1"
        aria-label="CV assistant conversation"
      >
        {cv.messages.length ? (
          cv.messages.slice(-30).map((message) => (
            <Panel
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-4 border-primary/15 bg-accent sm:ml-12"
                  : "mr-4 sm:mr-12"
              }
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {message.role === "user" ? "You" : "CVRaga assistant"}
                </h3>
                <Badge>CV v{message.cvRevision}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                {message.text}
              </p>
            </Panel>
          ))
        ) : (
          <Panel className="border-dashed">
            <p className="mb-3 font-medium">
              What would make this CV stronger?
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "Prioritize required skills and recent relevant achievements.",
                "Make the bullets concise while preserving verified metrics.",
                "Ask me about the highest-priority missing evidence in my latest CVRaga Match.",
              ].map((prompt, i) => (
                <Button
                  key={prompt}
                  variant="secondary"
                  onClick={() => {
                    form.setValue("message", prompt, { shouldDirty: true });
                    form.setValue("mode", i === 2 ? "question" : "refine");
                  }}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </Panel>
        )}
      </div>
      <Panel>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (data) => {
            try {
              await action.mutateAsync({
                id: cv.id,
                action: "assistant",
                revision: cv.currentRevision,
                ...data,
              });
              form.reset({
                message: "",
                mode: data.mode,
                saveKnowledge: data.saveKnowledge,
                perspective: data.perspective,
              });
            } catch {}
          })}
        >
          <fieldset disabled={action.isPending} className="space-y-4">
            <Field label="How can AI help?">
              <Select {...form.register("mode")}>
                <option value="refine">Discuss and refine my CV</option>
                <option value="question">Answer a question</option>
              </Select>
            </Field>
            <Field label="Perspective">
              <Select {...form.register("perspective")}>
                <option value="Combined">Combined perspectives</option>
                <option value="HR">HR</option>
                <option value="TeamLead">Team Lead</option>
                <option value="Management">Management</option>
              </Select>
            </Field>
            <Field
              label="Your message"
              error={form.formState.errors.message?.message}
            >
              <Textarea
                rows={5}
                {...form.register("message")}
                placeholder="Emphasize my React and testing work. Preserve verified metrics and make older roles shorter."
              />
            </Field>
            {mode === "refine" && !cv.applicationId && (
              <p className="text-sm text-muted-foreground">
                Choose a job posting above and tailor a role-specific CV first.
                You can ask questions about this general CV now.
              </p>
            )}
            <label className="flex min-h-control items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                {...form.register("saveKnowledge")}
                className="size-4 accent-primary"
              />
              Save my factual answers and corrections to My career
            </label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              With this enabled, your exact career statements become confirmed
              evidence. Questions and AI suggestions are not saved as facts. You
              can review or edit them in My career.
            </p>
            <ErrorNotice error={action.error} />
            {action.isPending && (
              <p role="status" className="text-sm text-primary">
                {mode === "refine"
                  ? "Refining your CV and checking its two-page PDF…"
                  : "Reading your CV and confirmed evidence…"}
              </p>
            )}
            <Button
              type="submit"
              busy={action.isPending}
              disabled={
                !settings.data?.aiConfigured ||
                (mode === "refine" && !cv.applicationId)
              }
            >
              <Send size={16} aria-hidden="true" />
              {mode === "refine" ? "Refine CV" : "Ask AI"}
            </Button>
          </fieldset>
        </form>
      </Panel>
    </div>
  );
}
