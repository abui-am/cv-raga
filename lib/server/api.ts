import "server-only";
import { z } from "zod";
import {
  applicationInputSchema,
  cvContentSchema,
  cvExtractionSchema,
  evidenceInputSchema,
  evidenceSchema,
  openQuestionSchema,
  requirementsSchema,
  sourceSchema,
  sourceSummarySchema,
} from "@/lib/contracts";
import {
  contentText,
  editableTargets,
  replaceTarget,
  uniqueRequirements,
  applyProposal,
} from "@/lib/domain";
import { aiModel, askAi } from "./ai";
import { getAuth } from "./auth";
import { withWorkspace } from "./workspace";
import { database } from "./db";
import { validateDocument, validateRequirements } from "./validation";
import {
  checkWriteOrigin,
  errorResponse,
  HttpError,
  jsonBody,
  requireValue,
  wire,
} from "./http";
import { importSource } from "./imports";
import { careerDocumentAction } from "./career-documents";
import { EXPORT_CHECK_VERSION } from "@/lib/export-contracts";
import { saveCareer, validateCareerEvidence } from "./career";
import { rebuildCareerIndex } from "./career-index";
import { careerEvidenceTitle } from "@/lib/career";
import { generateTailoring } from "./tailoring";
import { publicationEntries } from "@/lib/publications";
import { createRoleCv } from "./role-cv";
import { cvAssistant } from "./cv-assistant";

import { assessCv } from "./match";
import { optimizeMatch } from "./optimize-match";
import {
  getApplication,
  getCv,
  getEvidence,
  getProfile,
  listApplications,
  reviseCv,
} from "./records";

const revision = z.number().int().min(0);
const identifier = z.string().min(1).max(100);
const cvInclude = {
  revisions: { orderBy: { number: "desc" as const }, take: 1 },
};

async function dispatch(request: Request, parts: string[]) {
  const [resource, id, action] = parts;
  const db = database();
  const method = request.method;
  const url = new URL(request.url);
  if (parts.length > 3) throw new HttpError(404, "Endpoint not found");
  if (method !== "GET") checkWriteOrigin(request);
  if (resource === "repositories")
    throw new HttpError(
      403,
      "Local repository access is unavailable in a multi-user workspace.",
    );
  if (resource === "settings" && method === "GET" && !id) {
    await db.$queryRaw`SELECT 1`;
    return {
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
      model: aiModel(),
      database: "connected",
    };
  }
  if (resource === "profile" && !id) {
    if (method === "GET") return getProfile();
    if (method === "POST") {
      const body = z
        .object({ revision, content: cvContentSchema })
        .parse(await jsonBody(request));
      validateDocument(body.content);
      if (!body.content.name.trim())
        throw new HttpError(
          400,
          "Add your name before confirming your career details.",
        );
      return saveCareer(body.content, body.revision);
    }
  }
  if (resource === "sources") {
    if (!id && method === "GET")
      return sourceSummarySchema.array().parse(
        wire(
          await db.source.findMany({
            select: { id: true, name: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          }),
        ),
      );
    if (!id && method === "POST") {
      if (
        request.headers.get("content-type")?.startsWith("multipart/form-data")
      )
        return sourceSchema.parse(wire(await importSource(request)));
      const body = z
        .object({
          name: z.string().min(1).max(500),
          text: z.string().min(20).max(20000),
        })
        .parse(await jsonBody(request));
      return sourceSchema.parse(wire(await db.source.create({ data: body })));
    }
    if (id && !action && method === "GET")
      return sourceSchema.parse(
        wire(requireValue(await db.source.findUnique({ where: { id } }))),
      );
    if (id && action === "extract" && method === "POST") {
      const source = requireValue(
        await db.source.findUnique({ where: { id } }),
      );
      const draft = await askAi(
        cvExtractionSchema,
        "profile_draft",
        "Extract the CV into editable structured fields. Use empty strings/arrays for missing information. Put employment type (Full-time, Part-time, Contract), workMode (Remote, On-site, Hybrid or empty if unknown), and city/location in dedicated fields, never in achievement bullets. Remote roles have an empty location. Do not infer On-site from a city alone. Extract only explicitly stated languages and proficiency levels; never infer proficiency from a name, nationality or location. Sort education newest first by end date, current education first. Every experience/education/project needs a unique short ID using only letters and digits. Preserve the original facts and wording. This is an unconfirmed draft, never a saved profile.",
        { text: source.text },
      );
      return validateDocument(draft, true);
    }
  }
  if (resource === "career-index" && method === "POST" && !id) {
    await rebuildCareerIndex();
    return { indexed: true };
  }
  if (resource === "open-questions" && method === "GET" && !id) {
    return openQuestionSchema.array().parse(
      wire(
        await db.openQuestion.findMany({
          where: { status: "unsure" },
          orderBy: { createdAt: "desc" },
        }),
      ),
    );
  }
  if (resource === "evidence") {
    if (id === "populate" && method === "POST")
      throw new HttpError(
        410,
        "CV imports now belong in My career. Review and save career history once.",
      );
    if (method === "GET" && !id) {
      const search = (url.searchParams.get("search") || "").slice(0, 500);
      return evidenceSchema.array().parse(
        wire(
          await db.evidence.findMany({
            where: {
              consolidatedAt: null,
              ...(search
                ? {
                    OR: [
                      { title: { contains: search, mode: "insensitive" } },
                      { text: { contains: search, mode: "insensitive" } },
                      { tags: { has: search } },
                    ],
                  }
                : {}),
            },
            orderBy: { updatedAt: "desc" },
          }),
        ),
      );
    }
    if (method === "GET" && id && !action) return getEvidence(id);
    if (method === "POST" && !id) {
      const { openQuestionId, ...body } = evidenceInputSchema
        .extend({ openQuestionId: z.string().min(1).max(100).optional() })
        .parse(await jsonBody(request));
      if (body.sourceId)
        requireValue(
          await db.source.findUnique({ where: { id: body.sourceId } }),
          "Source document not found",
        );
      const record = await db.$transaction(async (tx) => {
        await validateCareerEvidence(tx, body.text, body.careerEntryId);
        const created = await tx.evidence.create({ data: body });
        if (openQuestionId) {
          const linked = await tx.openQuestion.updateMany({
            where: { id: openQuestionId, status: "unsure" },
            data: { status: "answered", evidenceId: created.id },
          });
          if (!linked.count)
            throw new HttpError(404, "That question is no longer open.");
        }
        return created;
      });
      return getEvidence(record.id);
    }
    if (method === "PATCH" && id && !action) {
      const body = evidenceInputSchema
        .extend({ revision })
        .parse(await jsonBody(request));
      const { revision: expected, ...data } = body;
      const update = await db.$transaction(async (tx) => {
        await validateCareerEvidence(tx, data.text, data.careerEntryId);
        return tx.evidence.updateMany({
          where: { id, revision: expected, consolidatedAt: null },
          data: { ...data, revision: { increment: 1 } },
        });
      });
      if (!update.count)
        throw new HttpError(
          409,
          "This evidence changed. Reload before saving.",
        );
      return getEvidence(id);
    }
    if (method === "DELETE" && id && !action) {
      const body = z.object({ revision }).parse(await jsonBody(request));
      const deleted = await db.evidence.deleteMany({
        where: { id, revision: body.revision },
      });
      if (!deleted.count) {
        requireValue(
          await db.evidence.findUnique({ where: { id }, select: { id: true } }),
          "Evidence not found",
        );
        throw new HttpError(
          409,
          "This evidence changed. Reload before deleting.",
        );
      }
      return { id };
    }
  }
  if (resource === "applications") {
    if (id && action === "create-cv" && method === "POST") {
      const body = z
        .object({ baseCvId: identifier.nullable(), postingRevision: revision })
        .parse(await jsonBody(request));
      return createRoleCv(id, body.baseCvId, body.postingRevision);
    }
    if (method === "GET" && !id) {
      const status = z
        .enum([
          "",
          "Saved",
          "Applied",
          "Interview",
          "Offer",
          "Rejected",
          "Withdrawn",
        ])
        .parse(url.searchParams.get("status") || "");
      return listApplications(
        (url.searchParams.get("search") || "").trim().slice(0, 500),
        status,
      );
    }
    if (method === "GET" && id && !action) return getApplication(id);
    if (method === "POST" && !id) {
      const body = applicationInputSchema.parse(await jsonBody(request));
      body.workMode ||= "";
      body.location =
        body.workMode === "Remote" ? "" : (body.location || "").trim();
      validateRequirements(body.requirements);
      if (body.submittedRevisionId)
        throw new HttpError(
          400,
          "Create the application before attaching its submitted CV.",
        );
      const app = await db.application.create({
        data: {
          ...body,
          requirements: uniqueRequirements(body.requirements),
          history: { create: { status: body.status } },
        },
      });
      return getApplication(app.id);
    }
    if (method === "PATCH" && id && !action) {
      const body = applicationInputSchema
        .extend({ revision })
        .parse(await jsonBody(request));
      const current = await getApplication(id);
      const { revision: expected, ...data } = body;
      data.workMode ??= current.workMode;
      data.location =
        data.workMode === "Remote"
          ? ""
          : (data.location ?? current.location).trim();
      validateRequirements(data.requirements);
      data.requirements = uniqueRequirements(data.requirements);
      if (data.submittedRevisionId) {
        const submitted = requireValue(
          await db.cvRevision.findUnique({
            where: { id: data.submittedRevisionId },
            include: { cv: true },
          }),
          "Submitted CV revision not found",
        );
        if (submitted.cv.applicationId !== id)
          throw new HttpError(
            400,
            "Choose a CV revision linked to this application.",
          );
      }
      const postingChanged =
        data.role !== current.role ||
        data.company !== current.company ||
        data.workMode !== current.workMode ||
        data.location !== current.location ||
        data.posting !== current.posting ||
        JSON.stringify(data.requirements) !==
          JSON.stringify(current.requirements);
      await db.$transaction(async (tx) => {
        const update = await tx.application.updateMany({
          where: { id, revision: expected },
          data: {
            ...data,
            revision: { increment: 1 },
            ...(postingChanged ? { postingRevision: { increment: 1 } } : {}),
          },
        });
        if (!update.count)
          throw new HttpError(
            409,
            "This application changed. Reload before saving.",
          );
        if (current.status !== data.status)
          await tx.statusEvent.create({
            data: { applicationId: id, status: data.status },
          });
      });
      return getApplication(id);
    }
    if (id && action === "analyze" && method === "POST") {
      const current = await getApplication(id);
      const parsed = await askAi(
        z.object({ requirements: requirementsSchema }),
        "job_requirements",
        "Extract distinct, atomic job requirements. Group hard qualifications as required, work duties as responsibility, explicitly optional experience as preferred. Avoid duplicates. Do not treat a monorepo as micro frontend experience or payment work as proof of banking employment. The ambiguous 'at least 2-4 years' means minimum 2, not a maximum of 4. Return short unique IDs.",
        { posting: current.posting },
      );
      const requirements = uniqueRequirements(parsed.requirements).map(
        (r, i) => ({ ...r, id: `r${i + 1}` }),
      );
      const update = await db.application.updateMany({
        where: { id, revision: current.revision },
        data: {
          requirements,
          revision: { increment: 1 },
          postingRevision: { increment: 1 },
        },
      });
      if (!update.count)
        throw new HttpError(
          409,
          "The posting changed while AI was reading it. Try again.",
        );
      return getApplication(id);
    }
  }
  if (resource === "cvs") {
    if (id && action === "optimize-match" && method === "POST")
      return optimizeMatch(id);
    if (id && action === "assistant" && method === "POST")
      return cvAssistant(request, id);
    if (id && ["proposal-preview", "accept-all"].includes(action)) {
      const cv = await getCv(id);
      const app = await getApplication(requireValue(cv.applicationId));
      const pending = cv.suggestions.filter((s) => s.status === "pending");
      if (!pending.length)
        throw new HttpError(404, "No pending proposal to review.");
      if (pending.some((s) => s.postingRevision !== app.postingRevision))
        throw new HttpError(409, "The job changed. Generate a fresh proposal.");
      let proposed;
      try {
        proposed = applyProposal(cv.revisions[0].content, pending);
      } catch {
        throw new HttpError(409, "The CV changed. Generate a fresh proposal.");
      }
      if (action === "proposal-preview" && method === "GET") {
        if (Number(url.searchParams.get("revision")) !== cv.currentRevision)
          throw new HttpError(409, "The CV changed. Refresh the proposal.");
        const { exportCv } = await import("./export");
        return new Response(new Uint8Array(await exportCv(proposed, "pdf")), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": "inline",
            "Cache-Control": "no-store",
          },
        });
      }
      if (action === "accept-all" && method === "POST") {
        const body = z.object({ revision }).parse(await jsonBody(request));
        if (body.revision !== cv.currentRevision)
          throw new HttpError(
            409,
            "The CV changed. Review the new revision first.",
          );
        const profile = await getProfile();
        const evidence = await db.evidence.findMany({
          where: { confirmed: true, consolidatedAt: null },
        });
        const sources = [
          ...cv.revisions.map((r) => ({
            id: `cv-${cv.id}-${r.number}`,
            text: contentText(r.content),
          })),
          ...(profile
            ? [
                {
                  id: `profile-${profile.revision}`,
                  text: contentText(profile.content),
                },
              ]
            : []),
          ...evidence.map((e) => ({
            id: `${e.id}-${e.revision}`,
            text: e.text,
          })),
        ];
        if (
          !pending.every((s) =>
            s.sources.every((ref) =>
              sources.some(
                (source) => source.id === ref.id && source.text === ref.text,
              ),
            ),
          )
        )
          throw new HttpError(
            409,
            "Supporting evidence changed. Generate a new proposal.",
          );
        validateDocument(proposed);
        const { measureCv } = await import("./export-quality");
        if ((await measureCv(proposed)) > 2)
          throw new HttpError(
            422,
            "This proposal exceeds two pages. Generate a more concise proposal.",
          );
        await db.$transaction(async (tx) => {
          const live = await tx.suggestion.count({
            where: {
              cvId: id,
              id: { in: pending.map((s) => s.id) },
              status: "pending",
            },
          });
          if (live !== pending.length)
            throw new HttpError(
              409,
              "A suggestion changed in another window. Reload first.",
            );
          const update = await tx.cv.updateMany({
            where: { id, currentRevision: cv.currentRevision },
            data: { currentRevision: { increment: 1 } },
          });
          if (!update.count)
            throw new HttpError(409, "The CV changed. Reload first.");
          await tx.cvRevision.create({
            data: {
              cvId: id,
              number: cv.currentRevision + 1,
              content: proposed,
              reason: "Accepted two-page tailoring proposal",
            },
          });
          await tx.suggestion.updateMany({
            where: { id: { in: pending.map((s) => s.id) } },
            data: { status: "accepted" },
          });
        });
        return getCv(id);
      }
      throw new HttpError(405, "Method not allowed");
    }
    if (
      id &&
      method === "POST" &&
      [
        "letter-generate",
        "letter-save",
        "persona-review",
        "review-apply",
      ].includes(action)
    )
      return careerDocumentAction(request, id, action);
    if (id && action === "export-check" && method === "POST") {
      const cv = await getCv(id);
      const { checkCvExports } = await import("./export-quality");
      const { result } = await checkCvExports(cv.revisions[0].content);
      await db.exportCheck.upsert({
        where: {
          cvId_cvRevision_version: {
            cvId: id,
            cvRevision: cv.currentRevision,
            version: EXPORT_CHECK_VERSION,
          },
        },
        create: {
          cvId: id,
          cvRevision: cv.currentRevision,
          version: EXPORT_CHECK_VERSION,
          result,
        },
        update: { result, createdAt: new Date() },
      });
      return getCv(id);
    }
    if (id && action === "letter-export" && method === "GET") {
      const cv = await getCv(id);
      const letter = requireValue(
        cv.coverLetters.find((l) => l.id === url.searchParams.get("letterId")),
        "Letter not found",
      );
      if (letter.status !== "accepted" || letter.stale)
        throw new HttpError(
          422,
          "Review and confirm a current cover letter before exporting.",
        );
      const format = z
        .enum(["pdf", "docx"])
        .parse(url.searchParams.get("format"));
      const { exportLetter } = await import("./export");
      const buffer = await exportLetter(
        letter.content,
        requireValue(cv.revisions.find((r) => r.number === letter.cvRevision))
          .content,
        format,
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            format === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="cover-letter-v${letter.number}.${format}"`,
          "Cache-Control": "no-store",
        },
      });
    }
    if (method === "GET" && !id) {
      const rows = await db.cv.findMany({
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      return Promise.all(rows.map((row) => getCv(row.id)));
    }
    if (method === "GET" && id && !action) return getCv(id);
    if (method === "POST" && !id) {
      const body = z
        .object({
          title: z.string().trim().min(1).max(500),
          applicationId: identifier.nullable(),
          baseCvId: identifier.nullable(),
        })
        .parse(await jsonBody(request));
      const profile = requireValue(
        await getProfile(),
        "Confirm your career details before creating a CV.",
      );
      if (body.applicationId) await getApplication(body.applicationId);
      const content = body.baseCvId
        ? (await getCv(body.baseCvId)).revisions[0].content
        : profile.content;
      const cv = await db.cv.create({
        data: {
          title: body.title,
          applicationId: body.applicationId,
          profileRevision: profile.revision,
          revisions: {
            create: {
              number: 1,
              content,
              reason: body.baseCvId
                ? "Copied from an existing CV"
                : "Created from confirmed career details",
            },
          },
        },
      });
      return getCv(cv.id);
    }
    if (method === "PATCH" && id && !action) {
      const body = z
        .object({ revision, content: cvContentSchema })
        .parse(await jsonBody(request));
      return reviseCv(id, body.revision, body.content, "Manual edit");
    }
    if (id && action === "restore" && method === "POST") {
      const body = z
        .object({ revision, number: z.number().int().min(1) })
        .parse(await jsonBody(request));
      const cv = await getCv(id);
      const original = requireValue(
        cv.revisions.find((r) => r.number === body.number),
        "CV revision not found",
      );
      return reviseCv(
        id,
        body.revision,
        original.content,
        `Restored revision ${body.number}`,
      );
    }
    if (id && action === "tailor" && method === "POST") {
      const cv = await getCv(id);
      const application = await getApplication(
        requireValue(cv.applicationId, "Link this CV to an application first."),
      );
      const profile = requireValue(await getProfile());
      const evidence = await db.evidence.findMany({
        where: { confirmed: true, consolidatedAt: null },
        orderBy: { updatedAt: "desc" },
      });
      const sources = [
        {
          id: `cv-${cv.id}-${cv.currentRevision}`,
          title: `Accepted CV · revision ${cv.currentRevision}`,
          text: contentText(cv.revisions[0].content),
        },
        {
          id: `profile-${profile.revision}`,
          title: `Confirmed career details · revision ${profile.revision}`,
          text: contentText(profile.content),
          publications: publicationEntries(profile.content),
        },
        ...evidence.map((e) => ({
          id: `${e.id}-${e.revision}`,
          title: careerEvidenceTitle(profile.content, e),
          text: e.text,
        })),
      ];
      const { changes } = await generateTailoring(
        cv.revisions[0].content,
        application,
        sources,
      );
      await db.$transaction(async (tx) => {
        // Recheck both revisions after the potentially slow external request.
        const live = requireValue(await tx.cv.findUnique({ where: { id } }));
        const posting = requireValue(
          await tx.application.findUnique({ where: { id: application.id } }),
        );
        if (
          live.currentRevision !== cv.currentRevision ||
          posting.postingRevision !== application.postingRevision
        )
          throw new HttpError(
            409,
            "The CV or posting changed during tailoring. Try again.",
          );
        await tx.suggestion.updateMany({
          where: { cvId: id, status: "pending" },
          data: { status: "rejected" },
        });
        if (changes.length)
          await tx.suggestion.createMany({
            data: changes.map((c) => ({
              cvId: id,
              baseRevision: cv.currentRevision,
              postingRevision: application.postingRevision,
              target: c.target,
              original: c.original,
              proposed: c.proposed,
              rationale: c.rationale,
              sources: sources.filter((s) => c.sourceIds.includes(s.id)),
            })),
          });
      });
      return getCv(id);
    }
    if (id && action === "suggestion" && method === "POST") {
      const body = z
        .object({
          suggestionId: identifier,
          decision: z.enum(["accept", "reject", "undo"]),
          revision,
          text: z.string().max(50000),
        })
        .parse(await jsonBody(request));
      const cv = await getCv(id);
      const suggestion = requireValue(
        cv.suggestions.find((s) => s.id === body.suggestionId),
        "Suggestion not found",
      );
      if (body.revision !== cv.currentRevision)
        throw new HttpError(
          409,
          "This CV changed. Reload before reviewing this change.",
        );
      if (body.decision === "reject") {
        if (suggestion.status !== "pending")
          throw new HttpError(
            409,
            "This suggestion has already been reviewed.",
          );
        await db.suggestion.update({
          where: { id: suggestion.id },
          data: { status: "rejected" },
        });
        return getCv(id);
      }
      const application = await getApplication(requireValue(cv.applicationId));
      if (
        application.postingRevision !== suggestion.postingRevision &&
        body.decision !== "undo"
      )
        throw new HttpError(
          409,
          "The job posting changed. Generate new suggestions.",
        );
      if (
        (body.decision === "accept" && suggestion.status !== "pending") ||
        (body.decision === "undo" && suggestion.status !== "accepted")
      )
        throw new HttpError(409, "This suggestion has already changed.");
      const current = editableTargets(cv.revisions[0].content)[
        suggestion.target
      ];
      const expected =
        body.decision === "undo" ? suggestion.proposed : suggestion.original;
      if (current !== expected)
        throw new HttpError(
          409,
          "This text changed since the proposal. Edit the CV directly or generate new suggestions.",
        );
      const value =
        body.decision === "undo" ? suggestion.original : body.text.trim();
      if (body.decision === "accept") {
        const profile = await getProfile();
        const evidence = await db.evidence.findMany({
          where: { confirmed: true, consolidatedAt: null },
        });
        const currentSources = [
          ...cv.revisions.map((r) => ({
            id: `cv-${cv.id}-${r.number}`,
            text: contentText(r.content),
          })),
          ...(profile
            ? [
                {
                  id: `profile-${profile.revision}`,
                  text: contentText(profile.content),
                },
              ]
            : []),
          ...evidence.map((e) => ({
            id: `${e.id}-${e.revision}`,
            text: e.text,
          })),
        ];
        if (
          !suggestion.sources.every((source) =>
            currentSources.some(
              (s) => s.id === source.id && s.text === source.text,
            ),
          )
        )
          throw new HttpError(
            409,
            "Supporting evidence changed or is no longer confirmed. Generate new suggestions.",
          );
      }
      // Store the exact approved wording so Undo works for user-edited proposals too.
      return reviseCv(
        id,
        cv.currentRevision,
        replaceTarget(cv.revisions[0].content, suggestion.target, value),
        body.decision === "undo" ? "Undid suggestion" : "Accepted suggestion",
        suggestion.id,
        body.decision === "undo" ? "undone" : "accepted",
        body.decision === "accept" ? value : undefined,
      );
    }
    if (id && action === "assess" && method === "POST") {
      const cv = await getCv(id);
      const application = await getApplication(
        requireValue(
          cv.applicationId,
          "Link this CV to an application to check its match.",
        ),
      );
      await assessCv(cv, application);
      return getCv(id);
    }
    if (id && ["export", "preview"].includes(action) && method === "GET") {
      const format =
        action === "preview"
          ? "pdf"
          : z.enum(["pdf", "docx"]).parse(url.searchParams.get("format"));
      const cv = requireValue(
        await db.cv.findUnique({ where: { id }, include: cvInclude }),
      );
      const number = url.searchParams.get("revision");
      const record = number
        ? requireValue(
            await db.cvRevision.findUnique({
              where: {
                cvId_number: {
                  cvId: id,
                  number: z.coerce.number().int().min(1).parse(number),
                },
              },
            }),
          )
        : cv.revisions[0];
      const content = cvContentSchema.parse(record.content);
      const { exportCv } = await import("./export");
      let buffer: Buffer;
      if (action === "preview") buffer = await exportCv(content, format);
      else {
        const { checkCvExports } = await import("./export-quality");
        const checked = await checkCvExports(content);
        if (!checked.result.passed)
          throw new HttpError(
            422,
            checked.result.pdfPages > 2
              ? `This CV is ${checked.result.pdfPages} pages. Tailor or shorten it to a maximum of 2 pages before exporting.`
              : "Export validation found a text order or heading pagination issue. Review and shorten the CV before exporting.",
          );
        buffer = checked[format];
      }
      const filename =
        (cv.title.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || "cv") +
        `-v${record.number}.${format}`;
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            format === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `${action === "preview" ? "inline" : "attachment"}; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }
  }
  throw new HttpError(404, "Endpoint not found");
}

export async function handle(request: Request, parts: string[]) {
  try {
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    if (!session) throw new HttpError(401, "Sign in to continue.");
    const result = await withWorkspace(session.user.id, () =>
      dispatch(request, parts),
    );
    return result instanceof Response
      ? result
      : Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
