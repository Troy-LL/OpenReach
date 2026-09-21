import type { RankedPaper } from "./types.js";

/** Policy weights — change without re-running Jev. */
export const WEIGHTS = {
  method: 0.3,
  population: 0.3,
  evidence: 0.25,
  recency: 0.15,
  reviewBonus: 0.1,
} as const;

export const RELEVANCE_THRESHOLD = 0.35;

export const METHOD_LEGENDS = [
  "Wrong or unrelated method for this need",
  "Method only tangentially related; unlikely to answer the need",
  "Reasonable method overlap; might partially address the need",
  "Strong method match; clearly uses approaches the user needs",
  "Core method match; directly applies the approach the user is looking for",
] as const;

export const POPULATION_LEGENDS = [
  "Wrong domain, setting, cohort, or system for this need",
  "Adjacent population; only weakly related to what the user asked about",
  "Plausible population overlap; might be useful background",
  "Strong population match; studies the right domain or cohort",
  "Core population match; directly targets the user's setting or system",
] as const;

export const EVIDENCE_LEGENDS = [
  "Thin or speculative; little usable evidence for this need",
  "Mostly opinion or secondary claims; weak support",
  "Some relevant evidence but not the main focus",
  "Solid primary evidence that supports the need",
  "Strong, clear evidence directly addressing the need",
] as const;

export const RECENCY_LEGENDS = [
  "Poor temporal fit for the user's time need",
  "Dated relative to the need; mostly historical context",
  "Acceptable age; still usable but not ideal for the time need",
  "Good temporal fit for the user's time need",
  "Excellent temporal fit; timing matches what the user needs",
] as const;

export function legendFor(
  levels: readonly string[],
  score: number,
): string {
  const idx = Math.min(4, Math.max(0, Math.round(score)));
  return levels[idx];
}

export function topicRelevance(method: number, population: number): number {
  return (method / 4 + population / 4) / 2;
}

export interface CompositeDims {
  method: number;
  population: number;
  evidence: number;
  recency: number;
  isReview: number;
}

export function compositeScore(
  dims: CompositeDims,
  preferReviews: boolean,
): number {
  const reviewTerm = preferReviews ? WEIGHTS.reviewBonus * dims.isReview : 0;
  return (
    WEIGHTS.method * (dims.method / 4) +
    WEIGHTS.population * (dims.population / 4) +
    WEIGHTS.evidence * (dims.evidence / 4) +
    WEIGHTS.recency * (dims.recency / 4) +
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
