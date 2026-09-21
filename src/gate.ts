import { DEFAULT_BM25_CAP, gateByBm25 } from "./bm25.js";
import { dedupePapers } from "./dedupe.js";
import type { QueryFacets } from "./query-split.js";
import type { Paper } from "./types.js";

export const RETRIEVE_LIMITS = {
  keywordLimit: 55,
  arxivLimit: 50,
  europePmcLimit: 50,
  crossrefLimit: 50,
  pubmedLimit: 50,
  inspireLimit: 45,
  ericLimit: 45,
  doajLimit: 45,
  openaireLimit: 45,
  preprintLimit: 45,
  plosLimit: 45,
  relatedLimit: 40,
  topicPaperLimit: 15,
} as const;

export interface FindOptions {
  /** How many papers to Jev-score immediately. UI uses 0; CLI uses a small page. */
  scoreFirst?: number;
}

function filterYearWindow(
  papers: Paper[],
  yearFrom: number | null,
  yearTo: number | null,
): Paper[] {
  if (yearFrom === null && yearTo === null) {
    return papers;
  }
  return papers.filter((paper) => {
    if (paper.year === null) {
      return true;
    }
    if (yearFrom !== null && paper.year < yearFrom) {
      return false;
    }
    if (yearTo !== null && paper.year > yearTo) {
      return false;
    }
    return true;
  });
}

/** Code-only post-retrieve gate: dedupe, optional year window, then BM25 cap (no Jev). */
export function gateRetrieved(
  question: string,
  papers: Paper[],
  facets?: Pick<QueryFacets, "yearFrom" | "yearTo">,
): Paper[] {
  const deduped = dedupePapers(papers, 500);
  const yearFiltered = filterYearWindow(
    deduped,
    facets?.yearFrom ?? null,
    facets?.yearTo ?? null,
  );
  return gateByBm25(question, yearFiltered, { cap: DEFAULT_BM25_CAP });
}
