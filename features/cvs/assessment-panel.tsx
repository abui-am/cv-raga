"use client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, CircleHelp, ScanText } from "lucide-react";
import { RUBRIC, type Cv } from "@/lib/contracts";
import { queries } from "@/lib/queries";
import { readiness } from "@/lib/domain";
import { useCvActions } from "@/lib/use-actions";
import { Badge, Button, ErrorNotice, Loading, Panel } from "@/components/ui";

export function AssessmentPanel({
  cv,
  onBusyChange,
  onDiscuss,
}: {
  cv: Cv;
  onBusyChange?: (busy: boolean) => void;
  onDiscuss?: () => void;
}) {
  const app = useQuery({
    ...queries.applications.detail(cv.applicationId || "unlinked"),
    enabled: Boolean(cv.applicationId),
  });
  const settings = useQuery(queries.settings.detail);
  const saved = useQuery({
    ...queries.assessments.detail(
      cv.id,
      cv.currentRevision,
      app.data?.postingRevision || 0,
      RUBRIC,
    ),
    enabled: Boolean(app.data),
  });
  const { action } = useCvActions();
  useEffect(() => {
    onBusyChange?.(action.isPending);
    return () => onBusyChange?.(false);
  }, [action.isPending, onBusyChange]);
  const optimization = [...cv.messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" &&
        message.cvRevision === cv.currentRevision &&
        message.text.startsWith("Match improvement:"),
    );
  const checks = readiness(cv.revisions[0].content);
  const exportCheck = cv.exportChecks.find((c) => !c.stale);
  const exportRow = checks.find(
    (c) => c.label === "Export reading order and pagination",
  )!;
  if (exportCheck) {
    exportRow.status = exportCheck.result.passed ? "Pass" : "Needs attention";
    exportRow.detail = `PDF: ${exportCheck.result.pdfPages}/${exportCheck.result.maxPages} pages. Text order: ${exportCheck.result.pdfReadingOrder ? "passed" : "needs review"}. Heading groups: ${exportCheck.result.headingGroups ? "passed" : "needs review"}. DOCX text order: ${exportCheck.result.docxReadingOrder ? "passed" : "needs review"}.`;
  } else
    exportRow.detail =
      "Validate the generated PDF and DOCX to check text order, heading groups and the two-page PDF limit.";
  const latest = saved.data?.[0];
  const history = cv.assessments.filter((a) => a.stale);
  return (
    <div className="space-y-6">
      <Panel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Document readiness</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Structure checks for accepted CV revision {cv.currentRevision}.
            </p>
          </div>
          <Badge>
            {checks.filter((c) => c.status === "Pass").length} / {checks.length}{" "}
            checks passed
          </Badge>
        </div>
        <ul className="divide-y divide-border">
          {checks.map((check) => (
            <li key={check.label} className="flex items-start gap-3 py-4">
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${check.status === "Pass" ? "bg-success text-primary" : "bg-muted text-muted-foreground"}`}
              >
                {check.status === "Pass" ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <CircleHelp size={13} aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="text-sm font-medium">{check.label}</h3>
                  <span className="text-xs text-muted-foreground">
                    {check.status}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {check.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Button
            variant="secondary"
            busy={
              action.isPending && action.variables?.action === "export-check"
            }
            disabled={action.isPending}
            onClick={() => action.mutate({ id: cv.id, action: "export-check" })}
          >
            Validate export & page count
          </Button>
          <ErrorNotice error={action.error} />
          <p className="mt-3 text-xs text-muted-foreground">
            Checks the generated files for this revision. DOCX page breaks can
            vary in Word or other editors.
          </p>
        </div>
      </Panel>
      <Panel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">CVRaga Match</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Estimated alignment with this job posting.
            </p>
          </div>
          <Button
            busy={action.isPending && action.variables?.action === "assess"}
            disabled={
              action.isPending ||
              !settings.data?.aiConfigured ||
              !app.data?.requirements.length
            }
            onClick={() => action.mutate({ id: cv.id, action: "assess" })}
          >
            <ScanText size={16} aria-hidden="true" />
            {action.isPending && action.variables?.action === "assess"
              ? "Evaluating accepted CV…"
              : "Calculate match"}
          </Button>
        </div>
        <ErrorNotice error={action.error || saved.error || app.error} />
        {cv.applicationId && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              busy={
                action.isPending &&
                action.variables?.action === "optimize-match"
              }
              disabled={
                action.isPending ||
                !settings.data?.aiConfigured ||
                !app.data?.requirements.length
              }
              onClick={() =>
                action.mutate({ id: cv.id, action: "optimize-match" })
              }
            >
              {action.isPending && action.variables?.action === "optimize-match"
                ? "Improving match and checking two-page PDF…"
                : "Improve match with AI"}
            </Button>
            <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
              Works through unmet checks using My career and general skills
              demonstrated by your work. Preserves supported checks, keeps two
              full pages, and asks about evidence still missing.
            </p>
          </div>
        )}
        {optimization && (
          <div className="mb-5 rounded-control bg-accent p-4 text-sm leading-relaxed text-primary">
            <p role="status" className="whitespace-pre-wrap">
              {optimization.text}
            </p>
            {onDiscuss && (
              <Button
                variant="secondary"
                className="mt-4"
                disabled={action.isPending}
                onClick={onDiscuss}
              >
                Continue with AI
              </Button>
            )}
          </div>
        )}
        {!cv.applicationId ? (
          <p className="rounded-control bg-background p-4 text-sm leading-relaxed text-muted-foreground">
            Create a CV from an application to compare it with a specific role.
          </p>
        ) : (
          <>
            <p className="mb-4 text-xs text-muted-foreground">
              {app.data?.role} · {app.data?.company} · posting v
              {app.data?.postingRevision || "…"}
            </p>
            {!settings.data?.aiConfigured && (
              <p className="mb-4 rounded-control bg-warning p-4 text-sm leading-relaxed text-warning-foreground">
                AI matching needs your OpenAI key. Document readiness and
                exports are available now.
              </p>
            )}
            {app.data && !app.data.requirements.length && (
              <p className="mb-4 text-sm text-muted-foreground">
                Add and review job requirements on the application before
                scoring.
              </p>
            )}
            {saved.isFetching && !latest ? (
              <Loading label="Reading saved assessments…" />
            ) : latest ? (
              <>
                <div className="mb-6 flex flex-wrap items-center gap-6 rounded-control bg-background p-5">
                  <div>
                    <span className="text-5xl font-semibold tracking-tight tabular-nums">
                      {latest.score}
                    </span>
                    <span className="ml-1 text-lg text-muted-foreground">
                      /100
                    </span>
                  </div>
                  <div className="max-w-sm">
                    <Badge tone={latest.score > 90 ? "good" : "warning"}>
                      {latest.score > 90
                        ? "Above target"
                        : "Below the >90 target"}
                    </Badge>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      This is CVRaga’s estimate, not an employer ATS score or a
                      hiring guarantee. Required gaps remain important at every
                      score.
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {latest.result.requirements.map((r) => {
                    const item = latest.result.items.find(
                      (i) => i.requirementId === r.id,
                    );
                    return (
                      <div
                        key={r.id}
                        className="rounded-control border border-border p-4"
                      >
                        <div className="mb-2 flex flex-wrap gap-2">
                          <Badge>
                            {r.group === "responsibility"
                              ? "Responsibility"
                              : r.group === "required"
                                ? "Required"
                                : "Preferred"}
                          </Badge>
                          <Badge
                            tone={
                              item?.status === "supported" ? "good" : "warning"
                            }
                          >
                            {item?.status === "supported"
                              ? "Supported"
                              : item?.status === "partial"
                                ? "Partially supported"
                                : "Not found in this CV"}
                          </Badge>
                        </div>
                        <h3 className="text-sm font-medium">{r.text}</h3>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {item?.reason}
                        </p>
                        {item?.cvQuote && (
                          <blockquote className="mt-3 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed">
                            “{item.cvQuote}”
                          </blockquote>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  CV v{latest.cvRevision} · posting v{latest.postingRevision} ·{" "}
                  {latest.rubric}
                </p>
              </>
            ) : (
              <p className="rounded-control bg-background p-5 text-sm leading-relaxed text-muted-foreground">
                {history.length
                  ? "Your CV or posting changed. Recalculate to assess the current revisions."
                  : "No match calculated yet. Only your accepted CV content will be scored."}
              </p>
            )}
            <details className="mt-5 text-xs text-muted-foreground">
              <summary className="min-h-control py-3 font-medium">
                How this estimate works
              </summary>
              <p className="leading-relaxed">
                Required qualifications: 60%; responsibilities: 30%; preferred
                experience: 10%. Groups that are absent are excluded and the
                remaining weights are normalized. Supported evidence earns full
                credit, partial evidence half, and absent evidence zero.
                Supporting quotes must appear in the accepted CV. Repeated
                keywords do not add credit. The target is 91–100; export is
                available at every score.
              </p>
            </details>
          </>
        )}
        {history.length > 0 && (
          <details className="mt-4 border-t border-border pt-3">
            <summary className="min-h-control py-3 text-sm font-medium">
              Previous assessments ({history.length})
            </summary>
            <ul className="space-y-3">
              {history.map((a) => (
                <li key={a.id} className="rounded-control bg-background p-3">
                  <p className="text-sm font-medium">
                    {a.score}/100 · CV v{a.cvRevision}, posting v
                    {a.postingRevision}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Stale · {new Date(a.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Panel>
    </div>
  );
}
