import { sanitizeSearchQuery } from "./query.js";

const OPENALEX = "https://api.openalex.org";
const MAILTO = process.env.OPENALEX_MAILTO ?? "openreach@localhost";
const USER_AGENT = "OpenReach/0.1 (mailto:openreach@localhost)";

export type SuggestKind = "work" | "topic" | "concept";

export interface Suggestion {
  id: string;
  text: string;
  hint: string | null;
  kind: SuggestKind;
}

export interface OpenAlexSuggestHit {
  id?: string;
  display_name?: string;
  hint?: string | null;
  cited_by_count?: number | null;
  entity_type?: string;
}

export function parseSuggestResults(
  hits: OpenAlexSuggestHit[],
  kind: SuggestKind,
): Suggestion[] {
  return hits
    .map((hit): Suggestion | null => {
      const text = (hit.display_name ?? "").trim();
      if (!text) return null;
      const id = (hit.id ?? "").trim() || `${kind}:${text}`;
      const hint = (hit.hint ?? "").trim() || null;
      return { id, text, hint, kind };
    })
    .filter((s): s is Suggestion => s !== null);
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

const KIND_RANK: Record<SuggestKind, number> = {
  work: 0,
  topic: 1,
  concept: 2,
};

/** Dedupe by normalized text; keep the highest-priority kind. */
export function rankSuggestions(
  suggestions: Suggestion[],
  limit = 8,
): Suggestion[] {
  const best = new Map<string, Suggestion>();
  for (const suggestion of suggestions) {
    const key = normalizeText(suggestion.text);
    if (!key) continue;
    const existing = best.get(key);
    if (
      !existing ||
      KIND_RANK[suggestion.kind] < KIND_RANK[existing.kind]
    ) {
      best.set(key, suggestion);
    }
  }
  return [...best.values()]
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind])
    .slice(0, limit);
}

async function fetchAutocomplete(
  entity: "works" | "topics" | "concepts",
  query: string,
): Promise<OpenAlexSuggestHit[]> {
  const url =
    `${OPENALEX}/autocomplete/${entity}?q=${encodeURIComponent(query)}` +
    `&mailto=${encodeURIComponent(MAILTO)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (res.status === 429 || !res.ok) return [];
  const data = (await res.json()) as { results?: OpenAlexSuggestHit[] };
  return data.results ?? [];
}

export async function suggestQueries(
  rawQuery: string,
  limit = 8,
): Promise<Suggestion[]> {
  const q = sanitizeSearchQuery(rawQuery);
  if (q.length < 2) return [];

  const [works, topics, concepts] = await Promise.all([
    fetchAutocomplete("works", q),
    fetchAutocomplete("topics", q),
    fetchAutocomplete("concepts", q),
  ]);

  return rankSuggestions(
    [
      ...parseSuggestResults(works, "work"),
      ...parseSuggestResults(topics, "topic"),
      ...parseSuggestResults(concepts, "concept"),
    ],
    limit,
  );
}
