import type { Paper } from "./types.js";

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^10\.48550\/arxiv\./i, "arxiv:");
}

/** Prefer papers with abstracts; when equal, keep the earlier source order. */
export function dedupePapers(papers: Paper[], cap = 120): Paper[] {
  const byKey = new Map<string, Paper>();

  for (const paper of papers) {
    if (!paper.title.trim()) continue;

    const key = paper.doi
      ? `doi:${normalizeDoi(paper.doi)}`
      : `title:${normalizeTitle(paper.title)}`;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, paper);
      continue;
    }

    const preferNew =
      (!existing.abstract && !!paper.abstract) ||
      (existing.abstract === paper.abstract &&
        !existing.url &&
        !!paper.url);

    if (preferNew) {
      byKey.set(key, paper);
    }
  }

  return [...byKey.values()]
    .filter((p) => p.abstract.trim().length > 0)
    .slice(0, cap);
}
