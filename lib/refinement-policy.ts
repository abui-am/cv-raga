import type { MatchItem, Requirement } from "./contracts";

export const GENERAL_SKILLS = [
  "Web development",
  "Programming fundamentals",
  "API integration",
  "Data handling",
  "Version control",
  "Testing",
  "Debugging",
  "Software security",
  "Technical documentation",
  "Communication",
  "Collaboration",
  "Team leadership",
  "Problem solving",
  "Planning and delivery",
] as const;

export const REFINEMENT_POLICY = `
# Candidate's refinement priorities
The primary objective is to satisfy the job's actual checklist using the candidate's full confirmed career record. Work through unmet required qualifications first, then responsibilities, then preferred criteria. Search saved career history, projects, skills, languages, publications and confirmed supporting evidence before asking the candidate. Express relevant existing evidence explicitly in the CV; do not merely add keywords or mark a check without evidence. Preserve evidence for checks already satisfied.
# Reasonable deductions of general skills
You may infer a GENERAL capability from documented work even when the source never names the capability verbatim. Examples: writing regression tests demonstrates testing; investigating and resolving defects demonstrates debugging/problem solving; implementing authorization/session controls demonstrates security-aware development; writing specifications or handoff documentation demonstrates technical communication; delivering with designers, clients or engineers demonstrates collaboration; leading three engineers demonstrates team leadership. Keep claims modest and at the demonstrated scope. Cite the concrete source behavior and explain the deduction in the rationale. Do not ask the candidate to reconfirm an ordinary capability already demonstrated by their record.
This permission does not establish an unmentioned tool, framework, architecture, industry, certification, language proficiency, metric, date, job title, authorship or seniority. Docker does not establish Kubernetes, a monorepo does not establish micro frontends, Go does not establish Java/Spring Boot, payment integrations do not establish banking employment, and English B2 must not become C1/fluent. Unconfirmed repository code never proves the candidate's contribution by itself.
# Conversation when evidence is missing
If a specific check cannot be supported by direct evidence or a reasonable general-skill deduction, ask one or two concrete questions about that check, role/project, personal contribution and outcome. Qualitative examples count; do not demand invented numbers. Do not ask for facts already available in the record. Make supported improvements while asking about remaining gaps; one missing answer must not block every other supported improvement. Deductions are explanations grounded in existing facts, not new user-confirmed career statements.
`;

export type Checklist = {
  requirements: Requirement[];
  items: Pick<MatchItem, "requirementId" | "status">[];
};
const credit = { absent: 0, partial: 1, supported: 2 };
export function unmetRequirements(result: Checklist) {
  return result.requirements
    .filter(
      (requirement) =>
        result.items.find((item) => item.requirementId === requirement.id)
          ?.status !== "supported",
    )
    .sort(
      (a, b) =>
        ({ required: 0, responsibility: 1, preferred: 2 })[a.group] -
        { required: 0, responsibility: 1, preferred: 2 }[b.group],
    );
}
export function preservesChecks(before: Checklist, after: Checklist) {
  return before.requirements.every((requirement) => {
    const previous =
      before.items.find((item) => item.requirementId === requirement.id)
        ?.status || "absent";
    const next =
      after.items.find((item) => item.requirementId === requirement.id)
        ?.status || "absent";
    return credit[next] >= credit[previous];
  });
}
export function improvesChecks(before: Checklist, after: Checklist) {
  return (
    preservesChecks(before, after) &&
    before.requirements.some((requirement) => {
      const previous =
        before.items.find((item) => item.requirementId === requirement.id)
          ?.status || "absent";
      const next =
        after.items.find((item) => item.requirementId === requirement.id)
          ?.status || "absent";
      return credit[next] > credit[previous];
    })
  );
}
