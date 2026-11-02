"use client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/queries";
import { type Cv } from "@/lib/contracts";
import { personas } from "@/lib/review-contracts";
import { reviewerDefinitions } from "@/lib/personas";
import { useCvActions } from "@/lib/use-actions";
import { Badge, Button, ErrorNotice, Panel } from "@/components/ui";

export function PersonaReviews({
  cv,
  onBusyChange,
  onPreview,
}: {
  cv: Cv;
  onBusyChange: (busy: boolean) => void;
  onPreview: () => void;
}) {
  const settings = useQuery(queries.settings.detail);
  const { action } = useCvActions();
  const reviewing =
    action.isPending && action.variables?.action === "persona-review";
  const applying =
    action.isPending && action.variables?.action === "review-apply";
  const latest = cv.reviewRuns.find((r) => !r.stale) || cv.reviewRuns[0];
  const history = cv.reviewRuns.filter((r) => r.id !== latest?.id);
  useEffect(() => {
    onBusyChange(action.isPending);
    return () => onBusyChange(false);
  }, [action.isPending, onBusyChange]);
  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              Three perspectives on your application
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              HR, Team Lead and Management review the accepted CV and any
              current confirmed cover letter independently. These are AI
              suggestions, not hiring decisions or an ATS score. Your CV stays
              unchanged until you choose “Apply review changes” after reading
              the feedback.
            </p>
          </div>
          <Button
            busy={reviewing}
            disabled={
              action.isPending ||
              !cv.applicationId ||
              !settings.data?.aiConfigured
            }
            onClick={() =>
              action.mutate({ id: cv.id, action: "persona-review" })
            }
          >
            {reviewing ? "Reviewing your CV…" : "Run 3 AI reviewers"}
          </Button>
        </div>
        <ErrorNotice error={action.error} />
        {latest?.improvement && (
          <div className="mt-4 rounded-control bg-accent p-4 text-sm leading-relaxed">
            {latest.improvement.status === "applied" ? (
              <>
                <p>
                  Review improvements were saved as revision{" "}
                  {latest.improvement.cvRevision}. The feedback below refers to
                  reviewed revision {latest.cvRevision}.
                </p>
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={onPreview}
                >
                  Preview updated CV
                </Button>
              </>
            ) : latest.improvement.status === "unchanged" ? (
              <p>
                The current CV already reflects the supported improvements and
                passes the two-page check.
              </p>
            ) : ["ready", "pending"].includes(latest.improvement.status) ? (
              <p role="status">
                The reviews are saved. Your CV is unchanged. Choose “Apply
                review changes” when you’re ready.
              </p>
            ) : (
              <p>{latest.improvement.error}</p>
            )}
          </div>
        )}
        {latest &&
          !latest.stale &&
          latest.results.every((r) => r.result) &&
          (!latest.improvement ||
            ["ready", "failed", "pending"].includes(
              latest.improvement.status,
            )) && (
            <Button
              variant="secondary"
              className="mt-4"
              busy={applying}
              disabled={action.isPending || !settings.data?.aiConfigured}
              onClick={() =>
                action.mutate({
                  id: cv.id,
                  action: "review-apply",
                  reviewId: latest.id,
                })
              }
            >
              {applying ? "Applying review changes…" : "Apply review changes"}
            </Button>
          )}
        {!cv.applicationId && (
          <p className="mt-4 text-sm text-muted-foreground">
            Link this CV to an application first.
          </p>
        )}
        {latest?.stale &&
          latest.improvement?.cvRevision !== cv.currentRevision && (
            <p className="mt-4 rounded-control bg-warning p-4 text-sm text-warning-foreground">
              The CV, job or confirmed letter changed. Run the reviewers again
              for the current application.
            </p>
          )}
      </Panel>
      {personas.map((persona) => {
        const definition = reviewerDefinitions[persona];
        const outcome = latest?.results.find((r) => r.persona === persona);
        return (
          <Panel key={persona}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{definition.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {definition.focus}
                </p>
              </div>
              <Badge>
                {outcome?.result
                  ? "Review complete"
                  : outcome?.error
                    ? "Could not complete"
                    : "Awaiting review"}
              </Badge>
            </div>
            {outcome?.result ? (
              <>
                <p className="mb-5 text-sm leading-relaxed">
                  {outcome.result.summary}
                </p>
                <div className="space-y-4">
                  {outcome.result.criteria.map((criterion) => (
                    <div
                      key={criterion.id}
                      className="rounded-control border border-border p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">
                          {
                            definition.criteria.find(
                              (c) => c.id === criterion.id,
                            )?.label
                          }
                        </h4>
                        <Badge
                          tone={
                            criterion.status === "evident"
                              ? "good"
                              : criterion.status === "not_assessed"
                                ? "neutral"
                                : "warning"
                          }
                        >
                          {criterion.status === "evident"
                            ? "Evidenced"
                            : criterion.status === "partial"
                              ? "Partially evidenced"
                              : criterion.status === "not_evident"
                                ? "Not evidenced here"
                                : "Not assessed"}
                        </Badge>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {criterion.observation}
                      </p>
                      {criterion.quote && (
                        <blockquote className="mt-3 border-l-2 border-primary/30 pl-3 text-sm leading-relaxed">
                          “{criterion.quote}”{" "}
                          <span className="text-xs text-muted-foreground">
                            (
                            {criterion.document === "cv"
                              ? "CV"
                              : "Cover letter"}
                            )
                          </span>
                        </blockquote>
                      )}
                      {criterion.nextStep && (
                        <p className="mt-3 text-sm leading-relaxed">
                          <span className="font-semibold">Next step: </span>
                          {criterion.nextStep}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {outcome?.error ||
                  definition.criteria.map((c) => c.label).join(" · ")}
              </p>
            )}
          </Panel>
        );
      })}
      {latest && (
        <p className="text-xs text-muted-foreground">
          CV v{latest.cvRevision} · Job v{latest.postingRevision} ·{" "}
          {latest.coverLetterId
            ? "Includes confirmed cover letter"
            : "CV only; cover letter not assessed"}{" "}
          · {latest.rubric}
        </p>
      )}
      {history.length > 0 && (
        <details>
          <summary className="min-h-control py-3 text-sm font-medium">
            Previous reviews ({history.length})
          </summary>
          {history.map((run) => (
            <p key={run.id} className="mb-2 text-xs text-muted-foreground">
              CV v{run.cvRevision}, job v{run.postingRevision} · stale ·{" "}
              {new Date(run.createdAt).toLocaleString()}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}
