export type PaperSource =
  | "openalex"
  | "semantic_scholar"
  | "related"
  | "arxiv"
  | "europe_pmc";

export interface Paper {
  id: string;
  title: string;
  abstract: string;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  source: PaperSource;
}

export interface Intent {
  field: "cs" | "biomed" | "physics" | "social" | "other";
  wantsReview: number;
  wantsEmpirical: number;
}

export interface RankedPaper extends Paper {
  /** False until this row has been Jev-scored for the current question. */
  scored: boolean;
  relevance: number;
  isReview: number;
  centrality: number;
  composite: number;
}

export interface TopicCandidate {
  id: string;
  displayName: string;
  description: string;
}

export interface SearchResult {
  question: string;
  intent: Intent | null;
  topics: TopicCandidate[];
  papers: RankedPaper[];
  /** Server session holding unscored papers; null when nothing is pending. */
  sessionId: string | null;
  /** Papers retrieved but not yet Jev-scored. */
  pending: number;
}
