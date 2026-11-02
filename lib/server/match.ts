import "server-only";
import { z } from "zod";
import {
  matchItemSchema,
  RUBRIC,
  type Cv,
  type Application,
  type CvContent,
} from "@/lib/contracts";
import { contentText, normalize, scoreMatch } from "@/lib/domain";
import { askAi, aiModel } from "./ai";
import { database } from "./db";
import { HttpError } from "./http";
import { REFINEMENT_POLICY } from "@/lib/refinement-policy";
import { selectEvidence } from "@/lib/evidence-selection";
export async function evaluateMatch(
  content: CvContent,
  application: Application,
  sources?: { id: string; text: string }[],
) {
  const aliases: Record<string, { id: string; text: string }> =
    Object.fromEntries(
      selectEvidence(sources || [], application.requirements).map(
        (source, index) => [`s${index + 1}`, source],
      ),
    );
  if (!application.requirements.length)
    throw new HttpError(400, "Add and review the job requirements first.");
  const schema = sources
    ? z.object({
        items: z.array(
          matchItemSchema.extend({
            sourceId: z.enum(["", ...Object.keys(aliases)]),
            sourceQuote: z.string().max(4000),
          }),
        ),
      })
    : z.object({ items: z.array(matchItemSchema) });
  const parsed = await askAi(
    schema,
    "cv_match",
    REFINEMENT_POLICY +
      "Evaluate every requirement against only the accepted CV text. supported = clear full evidence, partial = limited or adjacent evidence, absent = no evidence. For supported/partial, provide an exact contiguous quote from the CV (at least 8 characters), and explain precisely what is supported or missing. No credit for generic keyword repetition. No invented claims. Monorepo does not establish micro frontend architecture; payment integrations do not prove banking employment. A candidate with over 4 years satisfies a 2-4 year minimum. Do not credit facts absent from the CV. When confirmedSources are supplied, every supported/partial item must also cite sourceId and an exact sourceQuote of at least 8 characters proving the same claim or documenting behavior that reasonably demonstrates a GENERAL skill under the shared policy. Literal repetition of the general skill name in the source is not required; explain the inference in reason. Unverified or unsupported claims get no credit. Source-only evidence absent from the CV gets no credit. With no confirmedSources, evaluate the CV alone. Return exactly one item per requirement.",
    {
      requirements: application.requirements,
      cvText: contentText(content),
      confirmedSources: sources
        ? Object.entries(aliases).map(([id, source]) => ({
            id,
            text: source.text,
          }))
        : null,
    },
  );
  const items = sources
    ? parsed.items.map((item) => {
        if (item.status === "absent") return item;
        const referenced =
          "sourceId" in item && typeof item.sourceId === "string"
            ? aliases[item.sourceId]
            : null;
        const quote =
          "sourceQuote" in item && typeof item.sourceQuote === "string"
            ? item.sourceQuote
            : "";
        return referenced &&
          normalize(quote).length >= 8 &&
          normalize(referenced.text).includes(normalize(quote))
          ? { ...item, sourceId: referenced.id }
          : {
              requirementId: item.requirementId,
              status: "absent" as const,
              cvQuote: "",
              reason:
                "The proposed evidence could not be verified against a confirmed source.",
            };
      })
    : parsed.items;
  const result = scoreMatch(application.requirements, items, content);
  return {
    score: result.score,
    result: {
      items: result.items,
      requirements: application.requirements,
      model: aiModel(),
    },
  };
}

export async function assessCv(cv: Cv, application: Application) {
  const result = await evaluateMatch(cv.revisions[0].content, application);
  return database().assessment.create({
    data: {
      cvId: cv.id,
      cvRevision: cv.currentRevision,
      applicationId: application.id,
      postingRevision: application.postingRevision,
      rubric: RUBRIC,
      score: result.score,
      result: result.result,
    },
  });
}
