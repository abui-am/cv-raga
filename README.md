# CVRaga

Tailor your existing CV to a job posting, aiming for a CVRaga Match score above 90/100 while preserving your actual experience. Every generated CV uses our single, consistent ATS-friendly template.

## Product flow

1. **Your CV** — upload a PDF/DOCX or paste CV text. Review extracted details before continuing.
2. **Job posting** — paste the full description. Saving a new opportunity automatically generates a separate AI-tailored CV within two pages, using your confirmed career details or a selected CV. Uncheck automatic tailoring to save only the opportunity.
3. **Tailor & review** — AI suggests evidence-backed improvements. Accept, edit, or reject changes, then download the CV.

Keep the original CV intact. A new job posting starts a new tailoring run from the confirmed source CV.

The workspace has four areas:

- **My career:** maintain Personal details, Career history, and Supporting evidence in one workspace. Import a document once, review its career draft, then confirm the shared facts once. Repeated imports merge matching roles/projects without duplicating entries. Link extra outcomes, metrics, notes, or source material to a role, project, or education entry. Only confirmed supporting evidence is used in tailoring. Removing a career entry keeps its evidence as general evidence. Exact copies already in career history are consolidated out of the active library while their original rows and source documents are preserved. Saved CV versions are unchanged. The old Profile and Knowledge URLs redirect here; “Populate from CV” is retired.
- **Applications:** save full postings, review required/preferred criteria, track six statuses and their history, record dates/notes, and attach the exact CV revision submitted. Work arrangement is Remote, On-site, Hybrid or unspecified. Remote roles do not need a city; location is cleared and excluded from matching context. “Use banking example” loads the supplied job posting into an editable draft.
- **My CVs:** create a general or application-linked CV from your confirmed career details or an existing CV. Edit content, review evidence-backed AI suggestions, accept/edit/reject/undo, restore versions, and export PDF/DOCX. Preview shows the actual PDF pages with page numbers. A complete proposal has its own PDF preview before approval. Separate cover letters and three AI reviewer perspectives are available for linked applications.
- **ATS Check:** run local document-readiness checks and explicitly calculate an explainable job match. Editing the CV or posting makes previous matches stale without removing their history.

## Design guideline

**A better fit. Still your story.** Use a calm, document-focused workspace: warm neutrals, forest green, clear type, and generous spacing. Keep the next action obvious and the CV close to its supporting evidence.

### Tailwind theme

[app/globals.css](app/globals.css) is the source of truth for design tokens. Extend the installed Tailwind CSS v4 through its CSS theme; style components with semantic utilities. Use the default Tailwind spacing and responsive scales. [Tailwind theme documentation](https://tailwindcss.com/docs/theme).

- Canvas: `bg-background` — `#F7F8F5`; main text: `text-foreground` — `#202923`.
- Panels: `bg-card text-card-foreground` — white with charcoal text.
- Subtle surfaces: `bg-muted`; secondary text: `text-muted-foreground` — `#59665D`.
- Primary action: `bg-primary text-primary-foreground` — `#245C45` with white; hover: `hover:bg-primary-hover` — `#1B4835`.
- Selected state: `bg-accent text-accent-foreground` — `#EDF4EC` with forest green.
- Positive status: `bg-success text-success-foreground`.
- Attention: `bg-warning text-warning-foreground` — `#FFF3DF` with `#865218`.
- Errors: `text-destructive` — `#A93632`; subtle error surface: `bg-destructive/10`.
- Separators: `border-border` — `#DCE2DA`; field boundaries: `border-input` — `#7B887C`.
- Focus: `outline-ring` or `ring-ring` — forest green.

Use semantic colors in components rather than scattering raw color values. V1 uses a light interface; exported CVs always use black text on white.

### Typography and layout

- **App font:** existing Geist through `font-sans`; use `font-mono` for technical identifiers only.
- **Headings:** `text-3xl font-semibold tracking-tight` for pages; `text-xl font-semibold` for sections.
- **Body and inputs:** `text-base leading-relaxed`. Secondary labels use `text-sm`; captions use `text-xs` sparingly.
- **Scores:** `text-5xl tabular-nums`, with the label, denominator, and explanation alongside.
- **Spacing:** use `gap-4`, `gap-6`, `p-4`, `p-6`, and `py-12`; mobile gutters `px-4`, desktop `md:px-8`.
- **Containers:** `mx-auto w-full max-w-app` (1280 px); reading/form content `max-w-reading` (720 px).
- **Shape:** `rounded-control` (8 px), `rounded-panel` (12 px), square document corners.
- **Controls:** `min-h-control` (44 px). Keep visible labels and comfortable touch targets.
- **Responsive:** one column first; use `md:` at 768 px and `lg:` at 1024 px. Review can place changes beside the CV at `lg:`; mobile gets readable review/preview views.

### Component patterns

One primary action per step. Keep secondary actions visually quieter. Prefer existing Tailwind utilities and reusable React components.

```tsx
<button
  type="button"
  className="min-h-control rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
>
  Tailor my CV
</button>
```

- **Panel:** `rounded-panel border border-border bg-card p-4 text-card-foreground md:p-6`.
- **Input:** `min-h-control w-full rounded-control border border-input bg-card px-3 py-2 text-base text-foreground`; pair with a visible label and inline validation message.
- **Step navigation:** “Your CV → Job posting → Tailor & review”; show the current step and preserve input when going back.
- **Change review:** show Original, Suggested, rationale, and source evidence; provide Accept, Keep original, Edit, and Undo.
- **Requirement status:** Supported, Partially supported, or Not found; distinguish Required from Preferred. Always include text, not color alone.
- **Feedback:** describe real processing stages; retain input through recoverable errors. No fabricated progress percentages.
- **Accessibility:** visible keyboard focus, normal-text contrast of at least 4.5:1, meaningful labels, and reduced-motion support. Avoid gradients, decorative animation, and unnecessary shadows.

## ATS Classic — our only V1 template

Template ID: `ats-classic-v1`. Users edit content; they do not choose layouts, fonts, or colors. The AI returns structured content, and our renderer owns the format.

- **Page:** US Letter, 612 × 792 pt, with 42 pt margins, adapted from the supplied reference. CV PDFs have a hard maximum of **two pages**. The PDF.js preview renders the generated PDF itself, including real page breaks and “Page X of N” captions. Overlong drafts remain visible for editing; downloads require the two-page check to pass.
- **Font:** locally bundled Carlito via `font-cv`; `text-cv-body` is 11 pt / 1.25, `text-cv-name` is 22 pt, and section headings use `text-cv-heading uppercase` (11 pt, bold). The open font is embedded in PDF and DOCX, with its [OFL license](public/fonts/OFL.txt) included. [Font source](https://github.com/google/fonts/tree/main/ofl/carlito).
- **Color:** `bg-cv-background text-cv-foreground` — white and black, independent of the interface palette.
- **Layout:** one column, normal text flow, real bullet lists, and consistent dates such as `Apr 2022 – Present`.
- **Order:** centered name/contact → Professional summary → Technical skills → Professional experience → optional Programs & projects → Education → optional Certifications & awards. Omit empty sections. Thin section dividers and heading/first-content grouping keep the reference's restrained appearance.
- **Contact details:** body text at the top, with readable email addresses and URLs.
- **Avoid:** photos, logos, icons, charts, sidebars, layout tables, text boxes, hidden keywords, and contact information in page headers/footers.
- **Consistency:** [lib/template.ts](lib/template.ts) owns the template definition and ordered text blocks. Employment type, work arrangement and onsite city share the employer/date line; standalone legacy metadata bullets are normalized into that line. Remote roles omit the city. Education defaults to latest end date, ongoing education first; unknown dates keep their relative order. An explicit manual education order is saved and respected in the editor and exports. The PDF preview displays exported pages. DOCX consumes the same concise content and embedded font, but its pagination can vary by editor.

These layout choices follow conservative [resume-parsing guidance from Greenhouse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse). Validate text extraction, reading order, and pagination in the actual PDF/DOCX exporters before release.

## Tailoring and match rules

- Rephrase, reorder, and emphasize real experience. Never invent skills, employers, dates, degrees, responsibilities, certifications, or metrics.
- Explain each suggestion using the job requirement and supporting CV evidence. Missing experience stays visible; candidates may explicitly add and confirm relevant facts.
- Label the score **CVRaga Match** with “Estimated alignment with this job posting.” It is our explainable estimate, not an employer-issued ATS score or a hiring guarantee.
- The target is **strictly above 90/100**: 91–100 for whole-number scores. Do not fabricate qualifications to reach it, hide unmet required qualifications, or block export just because a score is lower.
- Score the current accepted CV. Editing the job posting or accepted wording makes previous analysis stale until recalculated. Career/evidence edits affect future tailoring; they do not silently rewrite saved CVs. Accepting a proposal rechecks that its supporting evidence is still confirmed and unchanged.
- Keep copy direct: “Review changes”, “Supported by your CV”, “Not found in your CV”, and “Download CV”.

In Edit content and My career, drag the handles on experience, project and education entries or use their move-up/move-down buttons. Open **Reorder…** beneath a bullet list, skills, links, or publications/certifications field to arrange its individual items. Bulk editing remains available in the text area. Moves preserve entry IDs, edited values and source links; save to create a new revision and update preview/PDF/DOCX. Section positions remain fixed. Education stays newest first until explicitly reordered.

### Two-page tailoring and file validation

AI tailoring requires exactly **two full US Letter pages** at the fixed 11pt font. The summary normally uses 60–100 words and can expand to 160 supported words; recent relevant roles usually retain 3–5 distinct bullets. The earlier 40-word summary and two-bullet caps have been removed. AI ranks every content unit by job relevance: required qualifications and direct responsibilities first, followed by recent relevant achievements. It condenses the summary, skills, whole bullet lists and certifications and orders bullets by relevance. A correction pass receives the actual failed draft, measured page count and a smaller word budget, rather than restarting from the original.

If both drafts still exceed two pages, local fitting follows the AI's priorities and renders after each cut. It removes optional projects, repeated detail, less relevant older roles or older education as needed. It protects the newest and most relevant role, their leading achievement, the newest/most relevant education and a core skills list. Retained facts and the fixed 11pt template stay intact. Omissions and iterative edits become one non-overlapping, reviewable proposal against the original, with readable selections and Undo. No source record is deleted. A complete AI proposal is saved only after its actual PDF fills both pages; an exceptionally oversized essential header still returns a truthful error without saving changes. Review the complete proposal PDF, then accept all changes as one new revision or review them individually. Unsaved wording edits disable bulk approval. Partial acceptance can still leave the accepted CV over budget; its real preview and export check show this.

If a draft leaves space, a single expansion pass offers cited summary alternatives and distinct job-relevant bullets, including supported nice-to-have qualifications and achievements. The server verifies exact source quotes, rejects duplicate or misplaced targets, and renders after each addition. An addition that would create a third page is skipped. A full result means exactly two pages with text reaching at least 94% of the usable height on **each** page, inside the existing print margins. This is an application layout target, measured from real PDF text coordinates using the installed PDF.js 5.4.296 API and its [viewport coordinate conversion](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html). No blank pages, hidden filler, stretched spacing or font changes are used. If distinct confirmed facts cannot fill both pages, generation explains which career details to add and preserves the saved CV. Manual drafts and partial suggestion approval may still be shorter; their preview shows their actual layout. The same filling stage runs for role creation, tailoring, assistant refinements and automatic reviewer edits.

Prompting check, 26 October 2026: the existing OpenAI SDK 7.43.0 and configured Luna model stay unchanged. Explicit constraints and relevant context follow [OpenAI's prompt-engineering guidance](https://developers.openai.com/api/docs/guides/prompt-engineering). Rendered-page enforcement and priority-based omissions are CVRaga application rules, verified through real PDF tests.

Adding a role has automatic tailoring enabled by default. The opportunity is saved first; AI then condenses and tailors a separate CV and validates PDF/DOCX exports before saving. There are at most two tailoring/shortening calls and one additional page-filling call, with local fitting using AI content priorities when necessary; provider failures are never retried automatically. The original source is revision 1 and the generated CV is revision 2, with AI changes explicitly labeled as generated. Review or edit the wording before sending. Repeating the same completed request reuses its CV; a failed generation leaves the opportunity saved with a retry action. Editing or refetching an opportunity does not invoke AI. “Create tailored CV” on an existing role runs this same workflow.

A general CV can select a saved job posting directly in its workspace, then tailor a separate role-specific copy. The tailoring button also works in the content editor when all changes are saved. Unsaved content, cover-letter or wording edits disable it with an explicit explanation; the editor tab alone does not block tailoring.

“Validate export & page count” generates PDF and DOCX, extracts their text, verifies ordered content, checks that PDF headings stay with following content, and counts PDF pages. Results are saved for that CV revision and renderer version; edits make old results stale. Download also runs the checks and rejects a PDF exceeding two pages. DOCX pagination needs a final check in the target editor; the automated DOCX check covers text order.

Publications in the confirmed career record are mandatory during tailoring and refinement. Their full article URLs are retained, bare IEEE/DOI/arXiv URLs gain an HTTPS scheme, and the template renders a separate Publications section with visible, clickable links in PDF and DOCX. Local page fitting cuts optional bullets or awards before publications. Publication and link preservation is enforced by application code as well as the AI instructions.

Personal details includes **Languages & proficiency**, entered one language and stated level per line. Confirmed values (for example, English — B2 (Upper Intermediate), Indonesian — Native) are available to AI through the career record and copied into new CVs. CV exports render a plain-text Languages section. Extraction keeps only stated proficiency and does not infer it from names or location.

### Separate cover letters

Generate a role-specific draft from the accepted CV, review the cited CV evidence, edit it, and use “Save & confirm letter” before download. Letters have their own version history and are tied to both CV and posting revisions. The prompt targets 250–350 words, with a 450-word maximum, specific examples and a concise opening/closing. It must not invent recipients, research, achievements, relocation willingness or qualifications. Letters are separate PDF/DOCX documents; they are not appended to the two-page CV.

### Checklist-first refinement and skill deductions

Refinement prioritizes required checks, responsibilities, then preferred checks. Existing confirmed career facts and supporting evidence come first. General skills can be deduced at the scope demonstrated by that work: regression tests support testing, resolving defects supports debugging, authorization/session work supports security-aware development, writing specifications supports technical communication, cross-functional delivery supports collaboration, and leading engineers supports team leadership. Rationales cite the behavior behind the deduction; a source need not repeat the general skill name verbatim. Deductions are not saved as new candidate-confirmed facts.

Specific tools, frameworks, architecture, industry employment, credentials, metrics and language levels still need their own evidence. Docker does not establish Kubernetes, payment work does not establish banking employment, and B2 is not upgraded to C1/fluent. Supported edits can proceed while the assistant asks about remaining gaps. Ordinary refinement requests with unmet job criteria use measured checklist improvement by default. Match rubric `cvraga-match-v2-grounded-skills` makes earlier assessments historical so current scoring uses this policy.

### HR, Team Lead and Management review

CVRaga adapts structured-assessment principles into **three independent AI perspectives**. This is a product design choice for document feedback, not a validated hiring predictor or three human evaluations. Each reviewer receives the same accepted CV, job context and current confirmed letter, with its own fixed criteria and no other reviewer's output. Personal contact details are omitted from reviewer input.

- **HR:** stated required qualifications, document clarity/chronology, and cover-letter relevance.
- **Team Lead:** applied technical evidence, engineering quality, and the candidate's individual contribution.
- **Management:** business/customer outcomes, collaboration/initiative, and ownership aligned with the role's level.

Each criterion reports Evidenced, Partially evidenced, Not evidenced here, or Not assessed, with a concrete next step. Positive/partial findings require a verifiable quote from the named document. A missing letter is not assessed. Missing document evidence must not be presented as proof of lacking ability. Protected characteristics, prestige, career-gap stereotypes, vague culture fit and unstated stack preferences are excluded. No combined score or hire/reject verdict is produced, and these reviews do not modify CVRaga Match.

Reviews are saved against CV, posting, confirmed-letter and rubric versions. Changes mark old reviews stale. Partial provider failures retain completed perspectives with an explicit failure for the others. Refetching saved reviews never calls AI.

Running the AI reviewers saves feedback and leaves the accepted CV unchanged. After reading all three perspectives, choose “Apply review changes” to explicitly create a new immutable CV revision with supported improvements, a two-page PDF and export validation. The original review stays bound to the version it inspected and records which newer revision the apply action produced. If applying fails, the reviews remain available for a retry. All three perspectives must complete before review changes can be applied. Reviewer suggestions are advice, not new factual evidence; cover-letter comments do not fabricate CV claims.

### CV assistant and My career

The AI assistant tab provides a saved conversation in Combined, HR, Team Lead or Management perspective. It uses the current CVRaga Match score and requirement breakdown to ask one or two focused follow-up questions about missing/partial evidence. If a linked job has reviewed requirements but no current match, it calculates the match first. Without a score/criteria, it uses the job context and explicitly avoids inventing a score. Question mode only discusses; Discuss and refine can automatically save a new, validated two-page CV revision when the facts are sufficient.

“Improve match with AI” evaluates up to two candidate revisions against the same saved criteria and prioritizes required gaps. Candidate scoring requires a verifiable CV quote and a supporting quote from confirmed sources. Before editing, it maps every unmet requirement to direct career evidence, a grounded general-skill deduction, or a concrete follow-up question. It searches all confirmed career sources and uses relevant contiguous excerpts when the library exceeds the model context budget. It applies the best supported candidate, preserving earlier versions and recording a fresh assessment atomically with the CV. A same-score candidate is allowed when it fills another check or corrects an oversized/underfilled original into two full pages. It continues above 90 while reviewed checks remain unmet, within the two-candidate bound. A higher score cannot erase an already supported or partially supported requirement. Score regressions are still discarded. Unsupported attempts are discarded. The assistant asks up to two specific questions for evidence still missing; Continue with AI opens the saved conversation to answer them. Existing evidence is used before asking the candidate to repeat facts; it never invents qualifications or guarantees an employer ATS score.

“Save my factual answers and corrections to My career” is enabled by default and clearly shown in the composer. Exact candidate statements become confirmed evidence with a source snapshot; questions, hypothetical claims, job requirements and AI suggestions are excluded. Explicit corrections update a referenced supporting evidence item with a revision check and preserve its previous text as a source. Duplicate facts are skipped. Turning the option off keeps the conversation without evidence writes. Conversation and evidence changes survive a later CV-refinement failure; the assistant reports that the CV was left unchanged.

### Local repository evidence

This legacy integration is disabled in multi-user mode. The description below documents its previous local behavior.

In My career → Supporting evidence, use “Choose repository” to browse folders and select a Git repository in the app, then “Find evidence with AI” to discover general evidence of what you built. No search topic is required. The overview samples project documentation, manifests and implementation from different folders; “Add a focus (optional)” narrows discovery to a technology or feature. Repositories are connected read-only and can be disconnected without touching files or existing evidence. AI receives only bounded excerpts and creates unconfirmed evidence drafts with repository, working-tree HEAD, relative file and line citations. Confirm your actual contribution before these drafts support tailoring.

Search respects Git ignore rules, skips dependency/build/generated directories and sensitive paths, rejects literal-secret content and prevents source-file symlinks escaping the selected repository. It does not run project code, Git hooks, builds or tests. Searches are bounded to 350 files / 2 MB and ten relevant excerpts per request. The folder picker uses a native dialog with keyboard focus trapping, Escape dismissal, visible focus and a responsive folder list, following the UI UX Pro Max guidance within the existing Tailwind design system.

The CV assistant also retrieves bounded excerpts from up to two connected repositories during a conversation, using current match gaps and your message as search context. It cites code locations when asking about your contribution. Those excerpts remain unconfirmed context until you state your own career facts; code alone does not prove authorship, production use or business impact.

Research checked 25 October 2026: [Google re:Work](https://rework.withgoogle.com/intl/en/guides/a-guide-to-structured-interviewing-for-better-hiring-practices) recommends role-related attributes and consistent rubrics; [GitLab's interviewing guide](https://handbook.gitlab.com/handbook/hiring/conducting-a-gitlab-interview/) emphasizes evidence-based scorecards and independent feedback; [OPM's structured interview guidance](https://www.opm.gov/policy-data-oversight/assessment-and-selection/structured-interviews/) grounds assessment in job competencies. Applying those human-interview practices to simulated CV-review personas is our implementation inference. [Harvard's resume/letter guidance](https://careerservices.fas.harvard.edu/resources/hes-create-impactful-resumes-and-cover-letters/) supports reverse chronology and concise, factual letters with role-specific examples.

## State management harnesses

These are agent instructions for the implemented state layer. Feature APIs and factories live under `features/`, the shared registry is [lib/queries.ts](lib/queries.ts), providers are in [app/providers.tsx](app/providers.tsx), and the CV review workflow uses a scoped vanilla Zustand store. The examples below are compact reference patterns.

Assign each state value one owner:

- **TanStack Query:** server records for profiles, career evidence, applications, CV revisions, and assessments. PostgreSQL persistence and Prisma access belong on the server.
- **React Hook Form + Zod:** editable form values and validation.
- **Zustand:** shared, temporary UI state such as wizard steps, selected IDs, and panel visibility.
- **React state:** interactions used by only one component.

### TanStack Query harness

When adding or changing server-state behavior:

1. Define keys and query functions beside their feature using `createQueryKeys`; combine feature factories with `mergeQueryKeys`. Include normalized filters, pagination, and IDs in keys. Assessment keys also include CV revision, posting revision, and rubric version. Keep CV text and credentials out of keys.
2. Use generated `.queryKey` and `._def` scopes throughout reads, cache updates, and invalidation. Keep HTTP calls in typed feature API modules that validate responses, throw on failed requests, and forward the query's `AbortSignal` to `fetch`. Let cancellation propagate.
3. Create one stable QueryClient per browser app and fresh clients for server rendering. Configure ordinary reads with a 60-second stale time and at most one retry for transient network/server failures; exclude canceled requests and ordinary validation/not-found errors from retries.
4. Use the v5 object syntax for `useQuery` and `useMutation`. Writes, imports, generation, and AI scoring use explicit mutations with `retry: false`; reading saved results uses queries. A refetch must not trigger a new AI operation.
5. After a successful write, use the complete returned record to update its detail cache, then await invalidation of every affected list scope. A status change can move an application between filters. Failed mutations preserve the existing cache. Optimistic updates require cancellation, a snapshot, rollback, and final invalidation; default to server-confirmed updates.
6. After a CV or posting edit, refresh affected CV/application records and assessment scopes. Display an assessment only for its matching revisions; retain old assessments as history. The server owns whether an assessment is stale.
7. Render initial pending, background fetching, error, and empty states distinctly. Preserve cached content during a background refetch. Use Query's loading/error state directly, and preserve dirty React Hook Form values until a successful save or explicit discard/reload.
8. Keep the query cache in memory. Saved personal documents belong in the database/file store; browser cache persistence requires a separately designed policy. Client API modules must not import Prisma or other server-only modules.

Reference pattern: `./api` represents a feature HTTP module. Its list/detail methods accept an `AbortSignal`, and `update` returns a complete application record. The implemented application module names its create/update method `save`. Other features join the same query registry.

```ts
import {
  createQueryKeys,
  mergeQueryKeys,
} from "@lukemorales/query-key-factory";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applicationsApi, type ApplicationFilters } from "./api";

const applications = createQueryKeys("applications", {
  list: (filters: ApplicationFilters) => ({
    queryKey: [filters],
    queryFn: ({ signal }) => applicationsApi.list(filters, signal),
  }),
  detail: (id: string) => ({
    queryKey: [id],
    queryFn: ({ signal }) => applicationsApi.detail(id, signal),
  }),
});

export const queries = mergeQueryKeys(applications);

export function useApplications(filters: ApplicationFilters) {
  return useQuery(queries.applications.list(filters));
}

export function useUpdateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: applicationsApi.update,
    retry: false,
    onSuccess: async (application) => {
      queryClient.setQueryData(
        queries.applications.detail(application.id).queryKey,
        application,
      );
      await queryClient.invalidateQueries({
        queryKey: queries.applications.list._def,
      });
    },
  });
}
```

Use the [Query Key Factory reference](https://github.com/lukemorales/query-key-factory) for factory APIs and the [TanStack Query v5 documentation](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations) for hooks and invalidation. Older positional hook examples and `refetchActive` options must be adapted to v5.

### Zustand harness

When adding or changing shared UI state:

1. Define typed state and named actions in a vanilla `createStore` factory. Model selections as IDs; retrieve the associated server records through TanStack Query. Keep form fields with React Hook Form and async request status with Query.
2. Instantiate a store once inside a client context provider, scoped to the route/workflow that owns its lifetime. Use deterministic initial values for matching server/client output. Each server render gets isolated state; React Server Components must not read or write Zustand stores.
3. Expose a selector-based hook that reports a missing provider clearly. Select individual values/actions; use `useShallow` from `zustand/react/shallow` for grouped object/tuple selections. Avoid whole-store subscriptions and selectors that return unstable references.
4. Update objects/arrays immutably through named actions. Compute derived values in selectors rather than storing a second copy. Invoke actions from events/effects, not during render.
5. Provide an explicit reset action using the store's initial state. Call it when starting a new workflow or explicitly abandoning the current one. Keep the provider mounted across steps that should retain UI state. Resetting a store changes UI state only; it must not delete database records or clear Query's cache.
6. Keep workflow stores in memory. If preference persistence is introduced, select only non-sensitive preferences with `partialize`, version the stored shape, and handle hydration explicitly. CV text, evidence, credentials, and server records must not be persisted through Zustand.

Reference pattern: one provider wraps the workflow, and consumers call the selector hook inside it. Place the provider at the shared route/layout boundary when steps should preserve their state.

```tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { useShallow } from "zustand/react/shallow";

type WizardState = { step: 1 | 2 | 3; selectedApplicationId: string | null };
type WizardStore = WizardState & {
  setStep: (step: WizardState["step"]) => void;
  selectApplication: (id: string | null) => void;
  reset: () => void;
};

export const createWizardStore = () =>
  createStore<WizardStore>()((set, _get, store) => ({
    step: 1,
    selectedApplicationId: null,
    setStep: (step) => set({ step }),
    selectApplication: (selectedApplicationId) =>
      set({ selectedApplicationId }),
    reset: () => set(store.getInitialState()),
  }));

type WizardStoreApi = ReturnType<typeof createWizardStore>;
const WizardContext = createContext<WizardStoreApi | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createWizardStore);
  return (
    <WizardContext.Provider value={store}>{children}</WizardContext.Provider>
  );
}

export function useWizardStore<T>(selector: (state: WizardStore) => T) {
  const store = useContext(WizardContext);
  if (!store) throw new Error("useWizardStore requires WizardProvider");
  return useStore(store, selector);
}

export function useWizardSelection() {
  return useWizardStore(
    useShallow((state) => ({
      step: state.step,
      selectedApplicationId: state.selectedApplicationId,
    })),
  );
}
```

Consult the [Zustand Next.js guide](https://zustand.docs.pmnd.rs/learn/guides/nextjs) for provider isolation and [the selector guide](https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow) for `useShallow` behavior.

### Agent completion checklist

Before completing a state-management change, verify the applicable scenarios and report what was checked:

- Changing an application's status refreshes detail and every filtered list it can enter or leave.
- CV/posting edits select assessments by the new revisions; refetching saved results never starts generation/scoring.
- Providers preserve state across intended navigation and isolate separate workflow mounts/server renders.
- Selectors remain stable, grouped selections use shallow comparison where needed, and updates are immutable.
- Workflow reset preserves saved records and Query cache; background reads preserve dirty forms.
- The change follows installed package versions and has focused verification for its actual behavior. These documentation examples do not substitute for runtime implementation or tests.

## Development

Runtime dependencies and scripts are listed in [package.json](package.json). Use Node 24.14+ (24.x), pnpm 11, and Docker. The Next.js app runs on the host; only PostgreSQL runs in Docker. Follow the [state management harnesses](#state-management-harnesses) when changing the data and UI layers.

For a fresh checkout, copy `.env.example` to `.env.local` once. Set a local PostgreSQL password and use the same URL-encoded password in `DATABASE_URL`. Keep any existing `.env.local`; never overwrite a configured key. The local setup created during implementation already has a random database password.

```bash
pnpm install
pnpm db:up
pnpm db:generate
pnpm db:deploy
pnpm dev
```

Open [CVRaga locally](http://127.0.0.1:3000). First-time users start at My career; returning users start at Applications. The development server binds to loopback. Email sign-in creates a private workspace for each account; configure authentication below before signing in.

### PostgreSQL and Prisma

[compose.yaml](compose.yaml) builds [docker/postgres/Dockerfile](docker/postgres/Dockerfile) from PostgreSQL 18.6. It binds `127.0.0.1:5433` by default, leaving host port 5432 untouched. PostgreSQL 18 stores its cluster beneath `/var/lib/postgresql`; the named volume mounts that parent directory. Credentials come from `.env.local`, never the image.

All application database access uses Prisma 7 with the PostgreSQL driver adapter and a process-scoped pool. [prisma/schema.prisma](prisma/schema.prisma) defines records, immutable CV revisions, status history and assessments. The checked-in migration is applied by `pnpm db:deploy`. For schema development use `pnpm db:migrate --name your_change` followed by `pnpm db:generate`.

Career unification, checked 26 October 2026: the shared career record retains the internal `Profile` model and `/api/profile` endpoint for compatibility. Supporting evidence has an optional stable career-entry link. Additive migration preserves original rows; `consolidatedAt` excludes exact duplicate career facts from the active library and tailoring. Career saves consolidate copies and detach links to removed entries in one revision-checked transaction; they never rewrite CV revisions. This follows [Prisma 7 transaction and concurrency guidance](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions). The Next.js 16.4.3 career route uses a local Suspense boundary for URL-dependent section selection, following the installed guide and [Next.js instant-navigation guidance](https://nextjs.org/docs/app/guides/instant-navigation).

`pnpm db:down` stops the database and preserves its named volume. Avoid `down -v` unless intentionally deleting the database. Back up the database with `pg_dump` and keep a separate backup of `.data/uploads`; both contain personal data. Neither database contents nor uploaded originals are committed to git.

### Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

The legacy browser suites still require authenticated fixtures before they can run against private workspaces. Use `CVRAGA_AUTH_DB_TESTS=1 pnpm exec vitest run tests/auth-integration.test.ts` after preparing the test database to check sign-in and tenant isolation.

Stop the development server before `test:e2e`; both use Next's development lock. Browser tests run on port 3100 against the separate local `cvraga_test` database. That test database is created/migrated automatically and cleared of test records before each suite. Tests explicitly disable live AI calls. They cover profile/document import, evidence, the banking example, immutable revisions, concurrency conflicts, reviewed changes/undo, stale assessments, status filters, PDF/DOCX text round trips and mobile overflow.

Unit tests check score weights, partial/absent evidence, quote validation, deduplication, targeted edits, readiness and workflow isolation. AI adapter tests use mocked responses; they do not establish live model output quality.

Read the relevant guides in `node_modules/next/dist/docs/` before changing Next.js code.

### OpenAI configuration

Set the developer key in the git-ignored `.env.local`, then restart the app:

```dotenv
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-6-luna
```

Read the key only on the server; never expose it through `NEXT_PUBLIC_`, browser code, URLs, or logs. [Official OpenAI authentication guidance](https://developers.openai.com/api/reference/overview).

AI uses the [Responses API with structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), server-side Zod validation, `store: false`, a timeout, and no automatic retries. Explicit extraction, tailoring, and match actions send the relevant text to OpenAI. Documents and postings are treated as untrusted data. Refetching a saved record never starts an AI request. Missing keys, refusals, incomplete responses and failures leave accepted content unchanged.

### V1 boundaries

Each signed-in account has a private workspace. Text-based PDF, DOCX and UTF-8 TXT imports support files up to 10 MB and 20,000 extracted characters. Scanned, encrypted or unreadable files offer paste-text recovery; there is no OCR. Originals use private random filenames in git-ignored `.data/uploads`. AI drafts and suggestions always need human review. The match is an estimate and cannot guarantee an employer's ATS result or a score above 90 for missing qualifications. Live AI behavior must be verified after configuring a valid key.

## Email sign-in and private workspaces

Authentication uses Better Auth 1.7 with a ten-minute, single-use email magic link delivered by Resend. Each account gets its own career details, documents, evidence, applications and CV history. API requests require a valid session; database operations filter by the session's user ID, and composite foreign keys prevent cross-workspace record links. Sign-out clears the browser workspace through a full navigation.

1. Add `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to `.env.local` using `.env.example`. Generate the secret with `openssl rand -base64 32`. Keep it stable across restarts and servers.
2. Use a sender on your verified Resend domain. The Resend test sender can only deliver to your own verified account address.
3. Run `pnpm db:deploy`, then restart the app. Use your exact browser origin for `BETTER_AUTH_URL` (locally, `http://127.0.0.1:3000`). Production requires your public HTTPS origin.
4. Open `/login`, enter an email, and follow the email link. New accounts are created automatically. Sessions last seven days. Rate limits are stored in PostgreSQL.

Existing shared records receive the owner `unassigned` and are invisible to signed-in users. They are preserved for an explicit administrator migration; do not automatically assign them to the first signup. Local filesystem repository browsing and the legacy global career-rag indexing endpoint are disabled because they do not isolate users. Document uploads and the normal career/CV workflow remain available.

Auth documentation checked November 2, 2026: [Better Auth magic links](https://www.better-auth.com/docs/plugins/magic-link), [Resend email API](https://resend.com/docs/api-reference/emails/send-email), and the installed Next.js 16.4.3 authentication/Cache Components guides. Workspace queries use Prisma 7.10.1 query extensions; nested writes are restricted to supported creates and stamped with ownership. The migration's additional composite foreign keys are intentional and must be preserved by future migrations.

Password sign-in is also enabled for administrator-provisioned credentials. Password signup is disabled; new users create accounts through email links. The sign-in page offers both methods. Passwords use Better Auth's built-in hashing and are never stored as plaintext.
