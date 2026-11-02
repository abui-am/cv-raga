import "server-only";
import { z } from "zod";
import { contentText, normalize } from "@/lib/domain";
import {
  coverLetterContentSchema,
  PERSONA_RUBRIC,
  personas,
  personaResultSchema,
  type ReviewRun,
} from "@/lib/review-contracts";
import { reviewerDefinitions, validatePersonaResult } from "@/lib/personas";
import { askAi, aiModel } from "./ai";
import { database } from "./db";
import { getApplication, getCv } from "./records";
import { HttpError, jsonBody, requireValue } from "./http";
import { refineCv } from "./refine-cv";
import type { Application, Cv } from "@/lib/contracts";

async function applyReview(
  cv: Cv,
  app: Application,
  run: Pick<
    ReviewRun,
    "id" | "cvRevision" | "postingRevision" | "results" | "improvement"
  >,
) {
  if (
    run.improvement?.status === "applied" ||
    run.improvement?.status === "unchanged"
  )
    return getCv(cv.id);
  if (
    run.cvRevision !== cv.currentRevision ||
    run.postingRevision !== app.postingRevision
  )
    throw new HttpError(
      409,
      "This review belongs to an older CV or posting. Run the reviewers on the current version.",
    );
  if (run.results.some((r) => !r.result))
    throw new HttpError(
      422,
      "All three reviewers must finish before changes can be applied.",
    );
  try {
    await refineCv(
      cv,
      app,
      {
        reviewerFeedback: run.results.map((r) => ({
          persona: r.persona,
          summary: r.result!.summary,
          criteria: r.result!.criteria.filter(
            (c) => c.id !== "hr_letter" && c.document !== "cover_letter",
          ),
        })),
      },
      "AI applied HR, Team Lead and Management review improvements",
      { reviewId: run.id },
    );
  } catch (error) {
    await database().reviewRun.update({
      where: { id: run.id },
      data: {
        improvement: {
          status: "failed",
          cvRevision: null,
          error:
            error instanceof HttpError
              ? error.message
              : "The reviews were saved, but applying the changes could not finish. Try applying the review again.",
        },
      },
    });
  }
  return getCv(cv.id);
}

function validateLetter(content: z.infer<typeof coverLetterContentSchema>) {
  if (content.paragraphs.join(" ").split(/\s+/).length > 450)
    throw new HttpError(
      422,
      "Keep the cover letter to 450 words or fewer so it fits on a separate page.",
    );
}
export async function careerDocumentAction(
  request: Request,
  id: string,
  action: string,
) {
  const db = database();
  const cv = await getCv(id);
  const app = await getApplication(
    requireValue(cv.applicationId, "Link this CV to an application first."),
  );
  const content = cv.revisions[0].content;
  const job = {
    company: app.company,
    role: app.role,
    posting: app.posting,
    requirements: app.requirements,
    workMode: app.workMode,
    location: app.workMode === "Remote" ? "" : app.location,
  };
  if (action === "review-apply") {
    const { reviewId } = z
      .object({ reviewId: z.string().min(1).max(100) })
      .parse(await jsonBody(request));
    return applyReview(
      cv,
      app,
      requireValue(
        cv.reviewRuns.find((r) => r.id === reviewId),
        "Review not found",
      ),
    );
  }
  if (action === "letter-generate" || action === "letter-save") {
    let letter;
    let quotes: string[] = [];
    let expected = cv.coverLetters[0]?.number || 0;
    if (action === "letter-generate") {
      const parsed = await askAi(
        z.object({
          content: coverLetterContentSchema,
          evidenceQuotes: z.array(z.string()).min(1).max(8),
        }),
        "cover_letter",
        "Write a separate, concise cover letter of 250-350 words, maximum 450 words, for this exact job. Use a clear opening about the role, one or two specific examples from the accepted CV, and a brief closing. Do not repeat the whole CV. Use the same factual scope and metrics as the CV. Cite exact contiguous CV quotes for the claims used. Do not invent a recipient, motivation, company research, relocation willingness, work authorization or qualifications. Use Dear Hiring Manager when no recipient is provided. For remote roles, do not treat the applicant's city as a gap or promise relocation. This is an unconfirmed draft requiring human review.",
        { job, cvText: contentText(content) },
      );
      letter = parsed.content;
      quotes = parsed.evidenceQuotes;
      if (
        !quotes.every(
          (q) =>
            q.trim().length >= 8 &&
            normalize(contentText(content)).includes(normalize(q)),
        )
      )
        throw new HttpError(
          422,
          "The letter contained an unverifiable supporting quote. Generate another draft.",
        );
    } else {
      const body = z
        .object({
          content: coverLetterContentSchema,
          baseNumber: z.number().int(),
          cvRevision: z.number().int(),
          postingRevision: z.number().int(),
        })
        .parse(await jsonBody(request));
      if (
        body.cvRevision !== cv.currentRevision ||
        body.postingRevision !== app.postingRevision
      )
        throw new HttpError(
          409,
          "The CV or job changed. Reload before confirming this letter.",
        );
      letter = body.content;
      expected = body.baseNumber;
      quotes =
        cv.coverLetters[0]?.evidenceQuotes.filter((q) =>
          normalize(contentText(content)).includes(normalize(q)),
        ) || [];
    }
    validateLetter(letter);
    await db.$transaction(async (tx) => {
      const live = await tx.cv.findUnique({ where: { id } });
      const posting = await tx.application.findUnique({
        where: { id: app.id },
      });
      const latest = await tx.coverLetter.findFirst({
        where: { cvId: id },
        orderBy: { number: "desc" },
      });
      if (
        live?.currentRevision !== cv.currentRevision ||
        posting?.postingRevision !== app.postingRevision ||
        (latest?.number || 0) !== expected
      )
        throw new HttpError(
          409,
          "The CV, job or letter changed. Reload before trying again.",
        );
      await tx.coverLetter.create({
        data: {
          cvId: id,
          number: expected + 1,
          cvRevision: cv.currentRevision,
          postingRevision: app.postingRevision,
          content: letter,
          evidenceQuotes: quotes,
          status: action === "letter-save" ? "accepted" : "draft",
        },
      });
    });
    return getCv(id);
  }
  if (action === "persona-review") {
    if (!process.env.OPENAI_API_KEY)
      throw new HttpError(
        503,
        "Add OPENAI_API_KEY to .env.local and restart to run AI reviewers.",
      );
    const letter = cv.coverLetters.find(
      (l) => l.status === "accepted" && !l.stale,
    );
    const documents = {
      cv: contentText({
        ...content,
        name: "",
        email: "",
        phone: "",
        location: "",
        links: [],
      }),
      cover_letter: letter
        ? [letter.content.subject, ...letter.content.paragraphs].join("\n\n")
        : "",
    };
    const settled = await Promise.allSettled(
      personas.map(async (persona) => {
        const definition = reviewerDefinitions[persona];
        const result = await askAi(
          personaResultSchema,
          `review_${persona.toLowerCase()}`,
          `Review as the ${definition.label} perspective. This is advisory document feedback, not a hire/reject decision, personality assessment or ATS score. Evaluate exactly the supplied three criteria independently; you do not see other reviewers' opinions. Focus on job-related evidence, not prestige, vague culture fit, age, gender, nationality, disability, names or career-gap stereotypes. Distinguish missing document evidence from lacking ability. Do not add criteria beyond the posting. Remote roles do not require geographic proximity. For evident/partial findings, quote at least 8 exact contiguous characters from the chosen document. For missing evidence, use not_evident, document none and empty quote; for unavailable material use not_assessed. Give a concrete, truthful next step, never an invented achievement or metric. Do not conflate monorepos with micro frontends or payment work with banking employment.`,
          { job, criteria: definition.criteria, documents },
        );
        return validatePersonaResult(persona, result, documents);
      }),
    );
    const results = settled.map((result, i) => ({
      persona: personas[i],
      result: result.status === "fulfilled" ? result.value : null,
      error:
        result.status === "rejected"
          ? "This perspective could not complete. Run the reviewers again to retry."
          : null,
    }));
    if (settled.every((r) => r.status === "rejected"))
      throw new HttpError(
        502,
        "The reviewers could not complete a valid review. Your saved documents are unchanged; try again.",
      );
    const improvement = {
      status: settled.every((r) => r.status === "fulfilled")
        ? ("ready" as const)
        : ("skipped" as const),
      cvRevision: null,
      error: settled.some((r) => r.status === "rejected")
        ? "All three perspectives must complete before you can apply review changes."
        : null,
    };
    const reviewData = {
      cvId: id,
      cvRevision: cv.currentRevision,
      postingRevision: app.postingRevision,
      coverLetterId: letter?.id || null,
      rubric: PERSONA_RUBRIC,
      model: aiModel(),
      results,
      improvement,
    };
    await db.reviewRun.create({
      data: reviewData,
    });
    return getCv(id);
  }
  throw new HttpError(404, "Document action not found");
}
