import type { PaperSource, RankedPaper } from "./types.js";

export const PAPER_SOURCES: PaperSource[] = [
  "openalex",
  "semantic_scholar",
  "arxiv",
  "europe_pmc",
  "related",
];

export type SortKey =
  | "composite"
  | "relevance"
  | "year_desc"
  | "year_asc"
  | "centrality"
  | "review";

export type PaperKind = "all" | "reviews" | "primary";

export interface ResultFilters {
  sort: SortKey;
  minRelevance: number;
  minCentrality: number;
  yearFrom: number | null;
  yearTo: number | null;
  includeUnknownYear: boolean;
  sources: PaperSource[] | null;
  kind: PaperKind;
  venueQuery: string;
  textQuery: string;
  requireDoi: boolean;
  requireUrl: boolean;
}

export const DEFAULT_FILTERS: ResultFilters = {
  sort: "composite",
  minRelevance: 0.35,
  minCentrality: 0,
  yearFrom: null,
  yearTo: null,
  includeUnknownYear: true,
  sources: null,
  kind: "all",
  venueQuery: "",
  textQuery: "",
  requireDoi: false,
  requireUrl: false,
};

function matchesText(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function yearOk(paper: RankedPaper, filters: ResultFilters): boolean {
  if (paper.year == null) return filters.includeUnknownYear;
  if (filters.yearFrom != null && paper.year < filters.yearFrom) return false;
  if (filters.yearTo != null && paper.year > filters.yearTo) return false;
  return true;
}

function kindOk(paper: RankedPaper, kind: PaperKind): boolean {
  if (!paper.scored) return kind === "all";
  switch (kind) {
    case "all":
      return true;
    case "reviews":
      return paper.isReview >= 0.6;
    case "primary":
      return paper.isReview < 0.4;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function scoreValue(paper: RankedPaper, sort: SortKey): number {
  if (
    !paper.scored &&
    (sort === "composite" ||
      sort === "relevance" ||
      sort === "centrality" ||
      sort === "review")
  ) {
    return Number.NEGATIVE_INFINITY;
  }
  switch (sort) {
    case "composite":
      return paper.composite;
    case "relevance":
      return paper.relevance;
    case "centrality":
      return paper.centrality;
    case "review":
      return paper.isReview;
    case "year_desc":
      return paper.year ?? Number.NEGATIVE_INFINITY;
    case "year_asc":
      return paper.year ?? Number.POSITIVE_INFINITY;
    default: {
      const _never: never = sort;
      return _never;
    }
  }
}

function compare(a: RankedPaper, b: RankedPaper, sort: SortKey): number {
  if (sort === "year_asc") return scoreValue(a, sort) - scoreValue(b, sort);
  return scoreValue(b, sort) - scoreValue(a, sort);
}

export function applyFilters(
  papers: RankedPaper[],
  filters: ResultFilters,
): RankedPaper[] {
  const venue = filters.venueQuery.trim();
  const text = filters.textQuery.trim();
  const sources = filters.sources;

  return papers
    .filter((paper) => {
      if (paper.scored) {
        if (paper.relevance < filters.minRelevance) return false;
        if (paper.centrality < filters.minCentrality) return false;
      }
      if (!yearOk(paper, filters)) return false;
      if (sources && sources.length > 0 && !sources.includes(paper.source)) {
        return false;
      }
      if (!kindOk(paper, filters.kind)) return false;
      if (venue && !matchesText(paper.venue ?? "", venue)) return false;
      if (
        text &&
        !matchesText(paper.title, text) &&
        !matchesText(paper.abstract, text) &&
        !matchesText(paper.venue ?? "", text)
      ) {
        return false;
      }
      if (filters.requireDoi && !paper.doi) return false;
      if (filters.requireUrl && !paper.url) return false;
      return true;
    })
    .sort((a, b) => compare(a, b, filters.sort));
}
