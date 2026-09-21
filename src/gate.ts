import { DEFAULT_BM25_CAP, gateByBm25 } from "./bm25.js";
import { dedupePapers } from "./dedupe.js";
import type { QueryFacets } from "./query-split.js";
import type { Paper } from "./types.js";

export const RETRIEVE_LIMITS = {
  keywordLimit: 30,
  arxivLimit: 20,
  europePmcLimit: 20,
  crossrefLimit: 20,
  pubmedLimit: 20,
  inspireLimit: 20,
  ericLimit: 20,
  doajLimit: 20,
  openaireLimit: 20,
  preprintLimit: 20,
  plosLimit: 20,
  relatedLimit: 20,
  topicPaperLimit: 8,
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
