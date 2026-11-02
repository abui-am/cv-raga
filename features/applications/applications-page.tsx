"use client";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Plus, Search } from "lucide-react";
import { statuses } from "@/lib/contracts";
import { queries } from "@/lib/queries";
import { useCvActions } from "@/lib/use-actions";
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
  buttonClass,
} from "@/components/ui";
import { ApplicationForm } from "./application-form";

export function ApplicationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);
  const deferred = useDeferredValue(search);
  const all = useQuery(queries.applications.list({ search: "", status: "" }));
  const list = useQuery(
    queries.applications.list({ search: deferred, status }),
  );
  const router = useRouter();
  const counts = [
    {
      label: "Opportunities saved",
      value: all.data?.filter((a) => a.status === "Saved").length,
    },
    {
      label: "Applications in progress",
      value: all.data?.filter((a) =>
        ["Applied", "Interview"].includes(a.status),
      ).length,
    },
    {
      label: "Offers received",
      value: all.data?.filter((a) => a.status === "Offer").length,
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="03 / Your next move"
        title="Make room for what’s next."
        description="Keep every opportunity, tailored CV, and next step in one place."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden="true" />
            Add opportunity
          </Button>
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {counts.map((c) => (
          <Panel key={c.label}>
            <p className="text-xs font-medium text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-4 text-3xl font-semibold tabular-nums">
              {c.value ?? "—"}
            </p>
          </Panel>
        ))}
      </div>
      {adding && (
        <div className="mb-8">
          <ApplicationForm
            onClose={() => setAdding(false)}
            onCreated={(app, cv) => {
              setAdding(false);
              router.push(cv ? `/cvs/${cv.id}` : `/applications/${app.id}`);
            }}
          />
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">All opportunities</h2>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <label className="relative min-w-0 flex-1 sm:w-64">
            <span className="sr-only">Search applications</span>
            <Search
              size={16}
              aria-hidden="true"
              className="absolute top-3.5 left-3 text-muted-foreground"
            />
            <Input
              placeholder="Search role or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </label>
        </div>
      </div>
      <ErrorNotice error={list.error || all.error} />
      {list.isPending ? (
        <Loading />
      ) : !list.data?.length ? (
        <Empty
          title={
            search || status
              ? "No matching opportunities"
              : "Your next chapter starts with one role."
          }
          description={
            search || status
              ? "Try another search or status filter."
              : "Save a job posting to track your application and create a CV for it."
          }
        >
          {!search && !status && (
            <Button variant="secondary" onClick={() => setAdding(true)}>
              Add your first opportunity
            </Button>
          )}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-panel border border-border bg-card">
          <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_24px] gap-5 border-b border-border bg-background px-6 py-3 text-xs font-medium text-muted-foreground md:grid">
            <span>Role & company</span>
            <span>Status</span>
            <span>Next action</span>
            <span />
          </div>
          {list.data.map((app) => (
            <Link
              key={app.id}
              href={`/applications/${app.id}`}
              className="grid items-center gap-3 border-b border-border px-5 py-5 last:border-0 hover:bg-background md:grid-cols-[minmax(0,2fr)_1fr_1fr_24px] md:gap-5 md:px-6"
            >
              <div className="min-w-0">
                <h3 className="font-semibold [overflow-wrap:anywhere]">
                  {app.role}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {app.company}
                  {app.workMode && ` · ${app.workMode}`}
                  {app.workMode !== "Remote" &&
                    app.location &&
                    ` · ${app.location}`}
                </p>
              </div>
              <div>
                <Badge
                  tone={
                    app.status === "Offer"
                      ? "good"
                      : app.status === "Interview"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {app.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {app.nextActionDate || "No date set"}
              </p>
              <div className="hidden md:block">
                <RowArrow />
              </div>
            </Link>
          ))}
        </div>
      )}
      {list.isFetching && !list.isPending && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          Refreshing opportunities…
        </p>
      )}
    </>
  );
}

export function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const app = useQuery(queries.applications.detail(id));
  const cvs = useQuery(queries.cvs.list);
  const settings = useQuery(queries.settings.detail);
  const { create, createForRole } = useCvActions();
  const router = useRouter();
  const [baseCvId, setBaseCvId] = useState("");
  if (app.isPending) return <Loading />;
  if (!app.data)
    return (
      <>
        <ErrorNotice error={app.error} />
        <Button onClick={() => app.refetch()}>Retry</Button>
      </>
    );
  const data = app.data;
  const linked = cvs.data?.filter((c) => c.applicationId === id) || [];
  return (
    <>
      <Link
        href="/applications"
        className="mb-6 inline-flex min-h-control items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        All opportunities
      </Link>
      <PageHeader
        eyebrow={data.company}
        title={data.role}
        description={
          [data.workMode, data.workMode === "Remote" ? "" : data.location]
            .filter(Boolean)
            .join(" · ") ||
          "Keep your application, evidence-backed CV, and next steps connected."
        }
        action={<Badge>{data.status}</Badge>}
      />
      <ErrorNotice error={app.error || cvs.error} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <ApplicationForm key={id} initial={data} />
        </div>
        <aside className="space-y-5">
          <Panel>
            <div className="mb-4 flex items-center gap-2">
              <FileText size={18} aria-hidden="true" className="text-primary" />
              <h2 className="font-semibold">CVs for this role</h2>
            </div>
            <div className="space-y-3">
              {linked.map((cv) => (
                <Link
                  href={`/cvs/${cv.id}`}
                  key={cv.id}
                  className="flex items-center justify-between gap-3 rounded-control border border-border p-3 hover:bg-background"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium [overflow-wrap:anywhere]">
                      {cv.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Revision {cv.currentRevision}
                      {data.submittedRevisionId &&
                      cv.revisions.some(
                        (r) => r.id === data.submittedRevisionId,
                      )
                        ? " · Submitted version recorded"
                        : ""}
                    </p>
                  </div>
                  <RowArrow />
                </Link>
              ))}
            </div>
            {!linked.length && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Create a separate CV for this application. Your career details
                and existing CVs stay intact.
              </p>
            )}
            <div className="mt-5 space-y-3">
              <Field label="Start from">
                <Select
                  value={baseCvId}
                  onChange={(e) => setBaseCvId(e.target.value)}
                >
                  <option value="">Confirmed career details</option>
                  {cvs.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} · v{c.currentRevision}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                busy={create.isPending || createForRole.isPending}
                disabled={settings.isPending}
                className="w-full"
                onClick={async () => {
                  try {
                    const cv = settings.data?.aiConfigured
                      ? await createForRole.mutateAsync({
                          id,
                          baseCvId: baseCvId || null,
                          postingRevision: data.postingRevision,
                        })
                      : await create.mutateAsync({
                          title: `${data.role} — ${data.company}`,
                          applicationId: id,
                          baseCvId: baseCvId || null,
                        });
                    router.push(`/cvs/${cv.id}`);
                  } catch {}
                }}
              >
                <Plus size={16} aria-hidden="true" />
                {createForRole.isPending
                  ? "Tailoring to two pages…"
                  : settings.data?.aiConfigured
                    ? "Create tailored CV"
                    : "Create CV"}
              </Button>
            </div>
            <ErrorNotice error={create.error || createForRole.error} />
          </Panel>
          <Panel>
            <h2 className="mb-4 font-semibold">Application timeline</h2>
            <ol className="space-y-4">
              {data.history.map((event, i) => (
                <li key={event.id} className="flex gap-3">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${i === 0 ? "bg-primary" : "bg-border"}`}
                  />
                  <div>
                    <p className="text-sm font-medium">{event.status}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
          <Link
            href="/ats"
            className={`${buttonClass} w-full border border-border bg-card`}
          >
            Check CV alignment <RowArrow />
          </Link>
        </aside>
      </div>
    </>
  );
}
