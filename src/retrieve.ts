import type { Intent, Paper, TopicCandidate } from "./types.js";
import { sanitizeSearchQuery, topicSearchQuery } from "./query.js";
import { searchArxiv, searchEuropePmc } from "./sources.js";

const OPENALEX = "https://api.openalex.org";
const S2 = "https://api.semanticscholar.org/graph/v1";
const MAILTO = process.env.OPENALEX_MAILTO ?? "openreach@localhost";
const USER_AGENT = "openreach/0.1 (research; mailto:openreach@localhost)";

export function invertAbstract(
  inverted: Record<string, number[]> | null | undefined,
): string {
  if (!inverted) return "";
  const positions: { word: string; index: number }[] = [];
  for (const [word, idxs] of Object.entries(inverted)) {
    for (const index of idxs) {
      positions.push({ word, index });
    }
  }
  positions.sort((a, b) => a.index - b.index);
  return positions.map((p) => p.word).join(" ");
}

async function getJson<T>(
  url: string,
  headers: Record<string, string> = {},
): Promise<T | null> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      ...headers,
    },
  });
  if (res.status === 429) {
    return null;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} for ${url}${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }
  return (await res.json()) as T;
}

interface OpenAlexWork {
  id: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  primary_location?: {
    landing_page_url?: string | null;
    source?: { display_name?: string | null } | null;
  } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  related_works?: string[] | null;
}

interface OpenAlexList<T> {
  results: T[];
}

interface OpenAlexTopic {
  id: string;
  display_name: string;
  description?: string | null;
}

interface S2Paper {
  paperId: string;
  title?: string | null;
  abstract?: string | null;
  year?: number | null;
  venue?: string | null;
  url?: string | null;
  externalIds?: { DOI?: string | null } | null;
}

function openAlexToPaper(work: OpenAlexWork, source: Paper["source"]): Paper {
  const title = (work.title ?? work.display_name ?? "").trim();
  const doi = work.doi
    ? work.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    : null;
  return {
    id: work.id,
    title,
    abstract: invertAbstract(work.abstract_inverted_index),
    year: work.publication_year ?? null,
    venue: work.primary_location?.source?.display_name ?? null,
    doi,
    url:
      work.primary_location?.landing_page_url ??
      (doi ? `https://doi.org/${doi}` : work.id),
    source,
  };
}

function s2ToPaper(p: S2Paper): Paper {
  const doi = p.externalIds?.DOI ?? null;
  return {
    id: `s2:${p.paperId}`,
    title: (p.title ?? "").trim(),
    abstract: (p.abstract ?? "").trim(),
    year: p.year ?? null,
    venue: p.venue ?? null,
    doi,
    url: p.url ?? (doi ? `https://doi.org/${doi}` : null),
    source: "semantic_scholar",
  };
}

export async function searchOpenAlexWorks(
  query: string,
  perPage = 25,
): Promise<{ papers: Paper[]; relatedIds: string[] }> {
  const q = sanitizeSearchQuery(query);
  if (!q) return { papers: [], relatedIds: [] };

  const url =
    `${OPENALEX}/works?search=${encodeURIComponent(q)}` +
    `&per_page=${perPage}&mailto=${encodeURIComponent(MAILTO)}` +
    `&select=id,doi,title,display_name,publication_year,primary_location,abstract_inverted_index,related_works`;
  const data = await getJson<OpenAlexList<OpenAlexWork>>(url);
  if (!data) return { papers: [], relatedIds: [] };

  const papers = data.results.map((w) => openAlexToPaper(w, "openalex"));
  const relatedIds = data.results
    .flatMap((w) => w.related_works ?? [])
    .slice(0, 15);
  return { papers, relatedIds };
}

export async function searchOpenAlexByTopic(
  topicId: string,
  perPage = 10,
): Promise<Paper[]> {
  const shortId = topicId.replace("https://openalex.org/", "");
  const url =
    `${OPENALEX}/works?filter=topics.id:${shortId}` +
    `&per_page=${perPage}&mailto=${encodeURIComponent(MAILTO)}` +
    `&select=id,doi,title,display_name,publication_year,primary_location,abstract_inverted_index,related_works`;
  const data = await getJson<OpenAlexList<OpenAlexWork>>(url);
  if (!data) return [];
  return data.results.map((w) => openAlexToPaper(w, "openalex"));
}

export async function fetchOpenAlexTopics(
  query: string,
  perPage = 12,
): Promise<TopicCandidate[]> {
  const base = topicSearchQuery(query);
  if (!base) return [];

  const words = base.split(/\s+/);
  const attempts = [
    base,
    words.slice(0, 3).join(" "),
    words.slice(0, 2).join(" "),
    words[words.length - 1],
    words[0],
  ].filter((q, i, arr) => q && arr.indexOf(q) === i);

  for (const q of attempts) {
    const url =
      `${OPENALEX}/topics?search=${encodeURIComponent(q)}` +
      `&per_page=${perPage}&mailto=${encodeURIComponent(MAILTO)}`;
    const data = await getJson<OpenAlexList<OpenAlexTopic>>(url);
    if (data?.results?.length) {
      return data.results.map((t) => ({
        id: t.id,
        displayName: t.display_name,
        description: t.description ?? "",
      }));
    }
  }
  return [];
}

export async function fetchOpenAlexWorksByIds(ids: string[]): Promise<Paper[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)].slice(0, 20);
  const filter = unique
    .map((id) => id.replace("https://openalex.org/", ""))
    .join("|");
  const url =
    `${OPENALEX}/works?filter=ids.openalex:${filter}` +
    `&per_page=${unique.length}&mailto=${encodeURIComponent(MAILTO)}` +
    `&select=id,doi,title,display_name,publication_year,primary_location,abstract_inverted_index,related_works`;
  const data = await getJson<OpenAlexList<OpenAlexWork>>(url);
  if (!data) return [];
  return data.results.map((w) => openAlexToPaper(w, "related"));
}

export async function searchSemanticScholar(
  query: string,
  limit = 25,
): Promise<Paper[]> {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];

  const key = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
  const headers: Record<string, string> = {};
  if (key) headers["x-api-key"] = key;

  const url =
    `${S2}/paper/search?query=${encodeURIComponent(q)}` +
    `&limit=${limit}&fields=paperId,title,abstract,year,venue,externalIds,url`;
  const data = await getJson<{ data?: S2Paper[] }>(url, headers);
  if (!data?.data) return [];
  return data.data.map(s2ToPaper);
}

export interface RetrieveOptions {
  keywordLimit?: number;
  topicPaperLimit?: number;
  relatedLimit?: number;
  arxivLimit?: number;
  europePmcLimit?: number;
  /** Topic ids already filtered as relevant by Jev. */
  topicIds?: string[];
  /** When set, Europe PMC runs for biomed (and always for other/cs soft). */
  field?: Intent["field"];
}

/**
 * High-reward sources:
 * - OpenAlex + Semantic Scholar (general)
 * - arXiv (preprints; especially CS / physics / ML)
 * - Europe PMC (biomed when intent says so, or as light boost for other)
 */
export async function retrieveCandidates(
  query: string,
  options: RetrieveOptions = {},
): Promise<Paper[]> {
  const keywordLimit = options.keywordLimit ?? 25;
  const topicPaperLimit = options.topicPaperLimit ?? 8;
  const relatedLimit = options.relatedLimit ?? 15;
  const arxivLimit = options.arxivLimit ?? 25;
  const europePmcLimit = options.europePmcLimit ?? 25;
  const field = options.field;

  const wantArxiv =
    field === undefined ||
    field === "cs" ||
    field === "physics" ||
    field === "other";
  const wantEuropePmc =
    field === undefined || field === "biomed" || field === "other";

  const [oa, s2, arxiv, epmc] = await Promise.all([
    searchOpenAlexWorks(query, keywordLimit),
    searchSemanticScholar(query, keywordLimit),
    wantArxiv ? searchArxiv(query, arxivLimit) : Promise.resolve([]),
    wantEuropePmc
      ? searchEuropePmc(query, europePmcLimit)
      : Promise.resolve([]),
  ]);

  const topicPapers =
    options.topicIds && options.topicIds.length > 0
      ? (
          await Promise.all(
            options.topicIds
              .slice(0, 3)
              .map((id) => searchOpenAlexByTopic(id, topicPaperLimit)),
          )
        ).flat()
      : [];

  const related = await fetchOpenAlexWorksByIds(
    oa.relatedIds.slice(0, relatedLimit),
  );

  return [
    ...oa.papers,
    ...s2,
    ...arxiv,
    ...epmc,
    ...topicPapers,
    ...related,
  ];
}
