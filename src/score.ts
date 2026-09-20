import type { RankedPaper } from "./types.js";

/** Policy weights — change without re-running Jev. */
export const WEIGHTS = {
  relevance: 0.7,
  centrality: 0.2,
  reviewBonus: 0.1,
} as const;

export const RELEVANCE_THRESHOLD = 0.35;

export function compositeScore(
  relevance: number,
  isReview: number,
  centrality: number,
  preferReviews: boolean,
): number {
  const reviewTerm = preferReviews ? WEIGHTS.reviewBonus * isReview : 0;
  return (
    WEIGHTS.relevance * relevance +
    WEIGHTS.centrality * (centrality / 4) +
    reviewTerm
  );
}

export function filterAndSort(
  papers: RankedPaper[],
  threshold = RELEVANCE_THRESHOLD,
): RankedPaper[] {
  return papers
    .filter((p) => p.relevance >= threshold)
    .sort((a, b) => b.composite - a.composite);
}
