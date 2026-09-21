import type { RankedPaper, SearchResult } from "./types.js";

/** Wire budget for paper abstracts. Session/Jev still keep the full text. */
export const API_ABSTRACT_CHARS = 480;

export function slimPaper<T extends { abstract: string }>(paper: T): T {
  if (paper.abstract.length <= API_ABSTRACT_CHARS) return paper;
  return { ...paper, abstract: paper.abstract.slice(0, API_ABSTRACT_CHARS) };
}

export function slimSearchResult(result: SearchResult): SearchResult {
  return {
    ...result,
    papers: result.papers.map((paper) => slimPaper(paper)),
  };
}

export function slimRankedPapers(papers: RankedPaper[]): RankedPaper[] {
  return papers.map((paper) => slimPaper(paper));
}
