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

function dedupeKey(paper: Paper): string {
  const doi = paper.doi?.trim();
  if (doi) {
    return `doi:${normalizeDoi(doi)}`;
  }
  return `title:${normalizeTitle(paper.title)}|year:${paper.year ?? ""}`;
}

function preferIncoming(existing: Paper, incoming: Paper): boolean {
  const existingAbstract = existing.abstract.trim();
  const incomingAbstract = incoming.abstract.trim();

  if (!existingAbstract && incomingAbstract) return true;
  if (existingAbstract && !incomingAbstract) return false;

  const existingUrl = existing.url?.trim() ?? "";
  const incomingUrl = incoming.url?.trim() ?? "";
  if (!existingUrl && incomingUrl) return true;
  if (existingUrl && !incomingUrl) return false;

  const existingVenue = existing.venue?.trim() ?? "";
  const incomingVenue = incoming.venue?.trim() ?? "";
  if (!existingVenue && incomingVenue) return true;

  return false;
}

/** Prefer richer abstract, then url, then venue; keep source order on ties. */
export function dedupePapers(papers: Paper[], cap = 120): Paper[] {
  const byKey = new Map<string, Paper>();

  for (const paper of papers) {
    if (!paper.title.trim()) continue;

    const key = dedupeKey(paper);

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, paper);
      continue;
    }

    if (preferIncoming(existing, paper)) {
      byKey.set(key, paper);
    }
  }

  return [...byKey.values()]
    .filter((p) => p.abstract.trim().length > 0)
    .slice(0, cap);
}
