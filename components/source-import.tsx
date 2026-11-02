"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, FileText } from "lucide-react";
import { profileApi } from "@/features/profile/api";
import type { Source } from "@/lib/contracts";
import { queries } from "@/lib/queries";
import {
  Button,
  ErrorNotice,
  Field,
  Input,
  Panel,
  Select,
  Textarea,
} from "./ui";

const pasteSchema = z.object({
  name: z.string().min(1).max(500),
  text: z.string().min(20, "Paste at least 20 characters").max(20000),
});
export function SourceImport({
  onSource,
}: {
  onSource: (source: Source) => void;
}) {
  const [tab, setTab] = useState<"upload" | "paste">("upload");
  const client = useQueryClient();
  const sources = useQuery(queries.profile.sources);
  const [savedSourceId, setSavedSourceId] = useState("");
  const selected = useQuery({
    ...queries.profile.source(savedSourceId || "none"),
    enabled: Boolean(savedSourceId),
  });
  const onSuccess = async (source: Source) => {
    client.setQueryData(queries.profile.source(source.id).queryKey, source);
    await client.invalidateQueries({
      queryKey: queries.profile.sources.queryKey,
    });
    onSource(source);
  };
  const form = useForm<z.infer<typeof pasteSchema>>({
    resolver: zodResolver(pasteSchema),
    defaultValues: { name: "Pasted career document", text: "" },
  });
  const upload = useMutation({
    mutationFn: profileApi.import,
    retry: false,
    onSuccess,
  });
  const paste = useMutation({
    mutationFn: profileApi.paste,
    retry: false,
    onSuccess,
  });
  const pending = upload.isPending || paste.isPending;
  return (
    <Panel>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Start with a document</h2>
        <div className="flex gap-1 rounded-control bg-muted p-1">
          <Button
            variant="quiet"
            aria-pressed={tab === "upload"}
            className={tab === "upload" ? "bg-card text-foreground" : ""}
            onClick={() => setTab("upload")}
          >
            Upload file
          </Button>
          <Button
            variant="quiet"
            aria-pressed={tab === "paste"}
            className={tab === "paste" ? "bg-card text-foreground" : ""}
            onClick={() => setTab("paste")}
          >
            Paste text
          </Button>
        </div>
      </div>
      {tab === "upload" ? (
        <label
          className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-control border border-dashed border-input bg-background p-6 text-center ${pending ? "opacity-50" : "hover:bg-accent/50"}`}
        >
          <Upload size={24} aria-hidden="true" className="text-primary" />
          <span className="text-sm font-semibold">
            {pending
              ? "Reading your document…"
              : "Choose your CV or career document"}
          </span>
          <span className="text-xs text-muted-foreground">
            PDF, DOCX or TXT · up to 10 MB · text-based files
          </span>
          <input
            type="file"
            aria-label="Upload career document"
            accept=".pdf,.docx,.txt"
            disabled={pending}
            className="max-w-full text-sm file:mr-3 file:min-h-control file:cursor-pointer file:rounded-control file:border-0 file:bg-muted file:px-4 file:font-medium"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <form
          onSubmit={form.handleSubmit((data) => paste.mutate(data))}
          className="space-y-4"
        >
          <Field
            label="Document name"
            error={form.formState.errors.name?.message}
          >
            <Input {...form.register("name")} />
          </Field>
          <Field
            label="Document text"
            error={form.formState.errors.text?.message}
          >
            <Textarea rows={8} {...form.register("text")} />
          </Field>
          <Button type="submit" busy={pending}>
            <FileText size={16} aria-hidden="true" />
            Use this text
          </Button>
        </form>
      )}
      <ErrorNotice error={upload.error || paste.error} />
      {Boolean(sources.data?.length) && (
        <details className="mt-5 border-t border-border pt-3">
          <summary className="min-h-control py-3 text-sm font-medium text-primary">
            Previously imported documents ({sources.data?.length})
          </summary>
          <div className="mt-2 space-y-3">
            <Field label="Saved document">
              <Select
                value={savedSourceId}
                onChange={(e) => setSavedSourceId(e.target.value)}
              >
                <option value="">Choose a document</option>
                {sources.data?.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name} ·{" "}
                    {new Date(source.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              variant="secondary"
              disabled={!selected.data || selected.isFetching}
              onClick={() => {
                if (selected.data) onSource(selected.data);
              }}
            >
              Use saved document
            </Button>
            <ErrorNotice error={selected.error} />
          </div>
        </details>
      )}
    </Panel>
  );
}
