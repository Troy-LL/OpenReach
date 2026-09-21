import type { Intent, Paper, TopicCandidate } from "./types.js";
import {
  searchCrossref,
  searchDoaj,
  searchEric,
  searchInspire,
  searchLifeSciencePreprints,
  searchOpenAire,
  searchPlos,
  searchPubmed,
} from "./indexes.js";
import { sanitizeSearchQuery, topicSearchQuery } from "./query.js";
import { searchArxiv, searchEuropePmc } from "./sources.js";
import type { PaperSource } from "./types.js";

const OPENALEX = "https://api.openalex.org";
const S2 = "https://api.semanticscholar.org/graph/v1";
const MAILTO = process.env.OPENALEX_MAILTO ?? "openreach@localhost";
const USER_AGENT = "OpenReach/0.1 (mailto:openreach@localhost)";

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
  crossrefLimit?: number;
  pubmedLimit?: number;
  inspireLimit?: number;
  ericLimit?: number;
  doajLimit?: number;
  openaireLimit?: number;
  preprintLimit?: number;
  plosLimit?: number;
  /** Topic ids already filtered as relevant by Jev. */
  topicIds?: string[];
  /** When set, specialty indexes gate by research field. */
  field?: Intent["field"];
}

/** Specialty indexes beyond the always-on general layer. */
export function specialtyIndexesFor(
  field: Intent["field"] | undefined,
): PaperSource[] {
  if (field === undefined || field === "other") {
    return [
      "arxiv",
      "inspire",
      "europe_pmc",
      "pubmed",
      "biorxiv",
      "medrxiv",
      "plos",
      "eric",
    ];
  }
  switch (field) {
    case "cs":
      return ["arxiv"];
    case "physics":
      return ["arxiv", "inspire"];
    case "biomed":
      return ["europe_pmc", "pubmed", "biorxiv", "medrxiv", "plos"];
    case "social":
      return ["eric"];
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

/**
 * Coverage map (field undefined ⇒ run every specialty):
 * - Always: OpenAlex, Semantic Scholar, Crossref, OpenAIRE, DOAJ
 * - CS: arXiv
 * - Physics: arXiv, INSPIRE-HEP
 * - Biomed: Europe PMC, PubMed, bioRxiv/medRxiv, PLOS
 * - Social: ERIC
 * - Other: all specialty indexes
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
  const crossrefLimit = options.crossrefLimit ?? 25;
  const pubmedLimit = options.pubmedLimit ?? 25;
  const inspireLimit = options.inspireLimit ?? 25;
  const ericLimit = options.ericLimit ?? 25;
  const doajLimit = options.doajLimit ?? 25;
  const openaireLimit = options.openaireLimit ?? 25;
  const preprintLimit = options.preprintLimit ?? 25;
  const plosLimit = options.plosLimit ?? 25;
  const specialty = new Set(specialtyIndexesFor(options.field));

  const [
    oa,
    s2,
    crossref,
    openaire,
    doaj,
    arxiv,
    epmc,
    pubmed,
    preprints,
    plos,
    inspire,
    eric,
  ] = await Promise.all([
    searchOpenAlexWorks(query, keywordLimit),
    searchSemanticScholar(query, keywordLimit),
    searchCrossref(query, crossrefLimit),
    searchOpenAire(query, openaireLimit),
    searchDoaj(query, doajLimit),
    specialty.has("arxiv")
      ? searchArxiv(query, arxivLimit)
      : Promise.resolve([]),
    specialty.has("europe_pmc")
      ? searchEuropePmc(query, europePmcLimit)
      : Promise.resolve([]),
    specialty.has("pubmed")
      ? searchPubmed(query, pubmedLimit)
      : Promise.resolve([]),
    specialty.has("biorxiv") || specialty.has("medrxiv")
      ? searchLifeSciencePreprints(query, preprintLimit)
      : Promise.resolve([]),
    specialty.has("plos")
      ? searchPlos(query, plosLimit)
      : Promise.resolve([]),
    specialty.has("inspire")
      ? searchInspire(query, inspireLimit)
      : Promise.resolve([]),
    specialty.has("eric")
      ? searchEric(query, ericLimit)
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
    ...crossref,
    ...openaire,
    ...doaj,
    ...arxiv,
    ...epmc,
    ...pubmed,
    ...preprints,
    ...plos,
    ...inspire,
    ...eric,
    ...topicPapers,
    ...related,
  ];
}
