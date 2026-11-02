"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowUp,
  ChevronRight,
  Folder,
  FolderGit2,
  Search,
  X,
} from "lucide-react";
import { queries } from "@/lib/queries";
import {
  Badge,
  Button,
  ErrorNotice,
  Field,
  Input,
  Loading,
  Panel,
  Select,
} from "@/components/ui";
import { repositoriesApi } from "./api";

function FolderPicker({
  open,
  onClose,
  onChoose,
  pending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (path: string) => void;
  pending: boolean;
  error: Error | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [path, setPath] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const folders = useQuery({
    ...queries.repositories.browse(path),
    enabled: open,
  });
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  const data = folders.data;
  const navigate = (next: string | null) => {
    setPath(next);
    setFilter("");
  };
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="repository-picker-title"
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-panel border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-foreground/30"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 id="repository-picker-title" className="text-lg font-semibold">
            Choose a local repository
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse to the folder containing your Git project.
          </p>
        </div>
        <Button
          variant="quiet"
          aria-label="Close folder picker"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </Button>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => navigate(null)}>
            Home
          </Button>
          <Button
            variant="quiet"
            disabled={!data?.parent || pending}
            onClick={() => navigate(data!.parent)}
          >
            <ArrowUp size={16} aria-hidden="true" />
            Up one folder
          </Button>
        </div>
        <p className="rounded-control bg-background px-3 py-2 text-sm [overflow-wrap:anywhere]">
          {data?.path || "Opening folders…"}
        </p>
        <Field label="Filter folders">
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Folder name…"
          />
        </Field>
        <div
          className="min-h-40 max-h-[35dvh] overflow-y-auto rounded-control border border-border"
          aria-label="Local folders"
        >
          {folders.isPending ? (
            <div className="p-5">
              <Loading label="Reading local folders…" />
            </div>
          ) : (
            data?.folders
              .filter((f) =>
                f.name.toLowerCase().includes(filter.toLowerCase()),
              )
              .map((folder) => (
                <Button
                  key={folder.path}
                  variant="quiet"
                  disabled={pending}
                  className="w-full justify-start rounded-none border-b border-border py-3 last:border-0"
                  onClick={() => navigate(folder.path)}
                >
                  {folder.isRepository ? (
                    <FolderGit2
                      size={19}
                      aria-hidden="true"
                      className="shrink-0 text-primary"
                    />
                  ) : (
                    <Folder size={19} aria-hidden="true" className="shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 text-left [overflow-wrap:anywhere]">
                    {folder.name}
                  </span>
                  {folder.isRepository && <Badge tone="good">Git</Badge>}
                  <ChevronRight size={16} aria-hidden="true" />
                </Button>
              ))
          )}
          {!folders.isPending &&
            data &&
            !data.folders.filter((f) =>
              f.name.toLowerCase().includes(filter.toLowerCase()),
            ).length && (
              <p className="p-5 text-sm text-muted-foreground">
                No matching subfolders.{" "}
                {data.isRepository
                  ? "You can select this repository below."
                  : "Go up to choose another folder."}
              </p>
            )}
        </div>
        <ErrorNotice error={folders.error || error} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {data?.isRepository
              ? "Git repository found"
              : "Open a Git project folder to select it"}
          </span>
          <Button
            busy={pending}
            disabled={!data?.isRepository || folders.isFetching}
            onClick={() => data && onChoose(data.path)}
          >
            Use this repository
          </Button>
        </div>
      </div>
    </dialog>
  );
}

const formSchema = z.object({
  query: z.string().trim().max(2000),
});
export function RepositoriesPanel() {
  const client = useQueryClient();
  const repositories = useQuery(queries.repositories.list);
  const settings = useQuery(queries.settings.detail);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const selected =
    repositories.data?.find((r) => r.id === selectedId) ||
    repositories.data?.[0];
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { query: "" },
  });
  const connect = useMutation({
    mutationFn: repositoriesApi.connect,
    retry: false,
    onSuccess: async (repo) => {
      setSelectedId(repo.id);
      await client.invalidateQueries({
        queryKey: queries.repositories.list.queryKey,
      });
      setPickerOpen(false);
    },
  });
  const disconnect = useMutation({
    mutationFn: repositoriesApi.disconnect,
    retry: false,
    onSuccess: async () => {
      setSelectedId("");
      await client.invalidateQueries({
        queryKey: queries.repositories.list.queryKey,
      });
    },
  });
  const search = useMutation({
    mutationFn: repositoriesApi.search,
    retry: false,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queries.knowledge.list._def }),
        client.invalidateQueries({
          queryKey: queries.profile.sources.queryKey,
        }),
      ]);
    },
  });
  return (
    <Panel className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <FolderGit2
              size={20}
              aria-hidden="true"
              className="shrink-0 text-primary"
            />
            <h2 className="text-lg font-semibold">Evidence from your code</h2>
            <span className="shrink-0 whitespace-nowrap">
              <Badge>Read-only</Badge>
            </span>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Connect a local Git repository. AI explores what you built and
            creates general evidence drafts with file and line citations. Review
            and confirm your contribution before tailoring uses it.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            connect.reset();
            setPickerOpen(true);
          }}
        >
          Choose repository
        </Button>
      </div>
      <ErrorNotice error={repositories.error || disconnect.error} />
      {repositories.data?.length ? (
        <form
          className="mt-5 space-y-4 border-t border-border pt-5"
          onSubmit={form.handleSubmit(async ({ query }) => {
            if (selected)
              try {
                await search.mutateAsync({ id: selected.id, query });
              } catch {}
          })}
        >
          <Field label="Repository">
            <Select
              value={selected?.id || ""}
              disabled={search.isPending}
              onChange={(event) => {
                setSelectedId(event.target.value);
                search.reset();
              }}
            >
              {repositories.data.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.name}
                </option>
              ))}
            </Select>
          </Field>
          {selected && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 flex-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {selected.path}
              </p>
              <Button
                variant="quiet"
                disabled={search.isPending}
                busy={disconnect.isPending}
                onClick={() => disconnect.mutate(selected.id)}
              >
                Disconnect
              </Button>
            </div>
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">
            Start with a general overview of the project’s features,
            technologies, and implementation. You don’t need to choose a
            specific topic.
          </p>
          <details>
            <summary className="min-h-control cursor-pointer py-3 text-sm font-medium text-primary">
              Add a focus (optional)
            </summary>
            <Field
              label="Focus on (optional)"
              hint="Leave blank to discover general evidence from the repository."
              error={form.formState.errors.query?.message}
            >
              <Input
                {...form.register("query")}
                placeholder="e.g. testing, performance, payment integrations"
                disabled={search.isPending}
              />
            </Field>
          </details>
          <ErrorNotice error={search.error} />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              busy={search.isPending}
              disabled={!settings.data?.aiConfigured || disconnect.isPending}
            >
              <Search size={16} aria-hidden="true" />
              {search.isPending
                ? "Exploring repository and verifying evidence…"
                : "Find evidence with AI"}
            </Button>
            {search.data && (
              <p role="status" className="text-sm text-muted-foreground">
                {search.data.created} drafts created · {search.data.skipped}{" "}
                duplicates skipped · {search.data.scanned} files reviewed.{" "}
                {search.data.created === 0 && search.data.skipped === 0 ? (
                  "No evidence drafts found. Try another repository or add an optional focus."
                ) : (
                  <a
                    href="#evidence-library"
                    className="font-medium text-primary underline underline-offset-4"
                  >
                    Review evidence
                  </a>
                )}
              </p>
            )}
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-control bg-background p-4 text-sm text-muted-foreground">
          Your repositories stay on this computer. Relevant excerpts are used
          when you discover evidence or talk to your CV assistant.
        </p>
      )}
      <FolderPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onChoose={(path) => connect.mutate(path)}
        pending={connect.isPending}
        error={connect.error}
      />
    </Panel>
  );
}
