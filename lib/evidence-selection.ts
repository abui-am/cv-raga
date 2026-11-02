import type { Requirement } from "./contracts";

type Source = {
  id: string;
  title?: string;
  text: string;
  publications?: string[];
};
const terms = (text: string) =>
  new Set(text.toLowerCase().match(/[\p{L}\p{N}+#.-]{3,}/gu) || []);
const expansions: [RegExp, string][] = [
  [
    /communication|collaborat|teamwork|komunikasi/i,
    "team client designer stakeholder specification documentation handoff review mentoring",
  ],
  [
    /test|quality|debug|troubleshoot/i,
    "regression vitest jest playwright defect bug investigate resolve coverage",
  ],
  [
    /security|secure/i,
    "authorization authentication permissions session revocation encryption",
  ],
  [
    /leadership|lead|management/i,
    "led mentored engineers team planning delivery",
  ],
];
function queryTerms(text: string) {
  return terms(
    [
      text,
      ...expansions
        .filter(([pattern]) => pattern.test(text))
        .map(([, related]) => related),
    ].join(" "),
  );
}
const overlap = (words: Set<string>, query: Set<string>) =>
  [...query].filter((word) => words.has(word)).length;

/** Search every source before selecting bounded, contiguous excerpts for an AI request. */
export function selectEvidence<T extends Source>(
  sources: T[],
  requirements: Pick<Requirement, "text" | "group">[],
  request = "",
): T[] {
  if (sources.length <= 800 && JSON.stringify(sources).length <= 110000)
    return sources;
  const queries = requirements.map((requirement) => ({
    words: queryTerms(requirement.text),
    weight: { required: 3, responsibility: 2, preferred: 1 }[requirement.group],
  }));
  const requestWords = queryTerms(request);
  const indexed = sources.map((source, index) => {
    const words = terms(
      `${source.id} ${source.id.replace(/-\d+$/, "")} ${source.title || ""} ${source.text}`,
    );
    return {
      source,
      index,
      words,
      core:
        index === 0 ||
        /^(cv-|profile-)/.test(source.id) ||
        Boolean(source.publications?.length),
      score:
        queries.reduce(
          (sum, query) => sum + overlap(words, query.words) * query.weight,
          0,
        ) +
        overlap(words, requestWords) * 3,
    };
  });
  const preferred = new Set(indexed.filter((item) => item.core));
  // Give each criterion a chance to retrieve a note, including notes late in the library.
  for (const query of queries) {
    const best = [...indexed]
      .filter((item) => !item.core)
      .sort(
        (a, b) => overlap(b.words, query.words) - overlap(a.words, query.words),
      )[0];
    if (best && overlap(best.words, query.words)) preferred.add(best);
  }
  const ordered = [
    ...preferred,
    ...indexed
      .filter((item) => !preferred.has(item))
      .sort((a, b) => b.score - a.score || a.index - b.index),
  ];
  const allTerms = new Set([
    ...requestWords,
    ...queries.flatMap((query) => [...query.words]),
  ]);
  const selected: T[] = [];
  let budget = 100000;
  for (const item of ordered) {
    if (selected.length >= 800 || budget < 400) break;
    let text = item.source.text;
    if (!item.core && text.length > 3000) {
      let start = 0,
        best = -1;
      for (let offset = 0; offset < text.length; offset += 2400) {
        const score = overlap(
          terms(text.slice(offset, offset + 3000)),
          allTerms,
        );
        if (score > best) {
          best = score;
          start = offset;
        }
      }
      text = text.slice(start, start + 3000);
    }
    const overhead = JSON.stringify({ ...item.source, text: "" }).length;
    if (text.length + overhead > budget) {
      if (item.core) continue;
      text = text.slice(0, Math.max(0, budget - overhead));
    }
    if (!text.trim()) continue;
    const source = { ...item.source, text };
    selected.push(source);
    budget -= JSON.stringify(source).length;
  }
  return selected;
}
