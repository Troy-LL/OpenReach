import type { Intent, Paper, TopicCandidate } from "./types.js";
import { authorsFromStringList } from "./authors.js";
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
import { resolvePaperUrl } from "./paper-url.js";
import { searchArxiv, searchEuropePmc } from "./sources.js";
import type { PaperSource } from "./types.js";
import { fetchUpstreamJson, settleIndex } from "./upstream.js";

const OPENALEX = "https://api.openalex.org";
const S2 = "https://api.semanticscholar.org/graph/v1";
const MAILTO = process.env.OPENALEX_MAILTO ?? "openreach@localhost";
export const RELATED_SKIP_AFTER = 80;
export const OPENALEX_WORK_SELECT =
  "id,doi,title,display_name,publication_year,primary_location,best_oa_location,open_access,abstract_inverted_index,related_works,authorships";
export const S2_PAPER_FIELDS =
  "paperId,title,abstract,year,venue,externalIds,url,authors,openAccessPdf";

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
  return fetchUpstreamJson<T>(url, headers);
}

interface OpenAlexLocation {
  landing_page_url?: string | null;
  pdf_url?: string | null;
  source?: { display_name?: string | null } | null;
}

interface OpenAlexWork {
  id: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  primary_location?: OpenAlexLocation | null;
  best_oa_location?: OpenAlexLocation | null;
  open_access?: { oa_url?: string | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  related_works?: string[] | null;
  authorships?: { author?: { display_name?: string | null } | null }[] | null;
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
  authors?: { name?: string | null }[] | null;
  openAccessPdf?: { url?: string | null } | null;
}

export function openAlexToPaper(work: OpenAlexWork, source: Paper["source"]): Paper {
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
    url: resolvePaperUrl(
      [
        work.best_oa_location?.pdf_url,
        work.open_access?.oa_url,
        work.best_oa_location?.landing_page_url,
        work.primary_location?.landing_page_url,
      ],
      doi,
    ),
    source,
    authors: authorsFromStringList(
      work.authorships?.map((a) => a.author?.display_name ?? ""),
    ),
  };
}

export function s2ToPaper(p: S2Paper): Paper {
  const doi = p.externalIds?.DOI ?? null;
  return {
    id: `s2:${p.paperId}`,
    title: (p.title ?? "").trim(),
    abstract: (p.abstract ?? "").trim(),
    year: p.year ?? null,
    venue: p.venue ?? null,
    doi,
    url: resolvePaperUrl([p.openAccessPdf?.url, p.url], doi),
    source: "semantic_scholar",
    authors: authorsFromStringList(p.authors),
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
    `&select=${OPENALEX_WORK_SELECT}`;
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
    `&select=${OPENALEX_WORK_SELECT}`;
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
    `&select=${OPENALEX_WORK_SELECT}`;
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
    `&limit=${limit}&fields=${S2_PAPER_FIELDS}`;
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
  /** Skip the related-works follow-up once the first wave has this many unique ids. */
  relatedSkipAfter?: number;
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
  const relatedSkipAfter = options.relatedSkipAfter ?? RELATED_SKIP_AFTER;
  const empty: Paper[] = [];

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
    settleIndex(searchOpenAlexWorks(query, keywordLimit), {
      papers: empty,
      relatedIds: [] as string[],
    }),
    settleIndex(searchSemanticScholar(query, keywordLimit), empty),
    settleIndex(searchCrossref(query, crossrefLimit), empty),
    settleIndex(searchOpenAire(query, openaireLimit), empty),
    settleIndex(searchDoaj(query, doajLimit), empty),
    specialty.has("arxiv")
      ? settleIndex(searchArxiv(query, arxivLimit), empty)
      : empty,
    specialty.has("europe_pmc")
      ? settleIndex(searchEuropePmc(query, europePmcLimit), empty)
      : empty,
    specialty.has("pubmed")
      ? settleIndex(searchPubmed(query, pubmedLimit), empty)
      : empty,
    specialty.has("biorxiv") || specialty.has("medrxiv")
      ? settleIndex(searchLifeSciencePreprints(query, preprintLimit), empty)
      : empty,
    specialty.has("plos")
      ? settleIndex(searchPlos(query, plosLimit), empty)
      : empty,
    specialty.has("inspire")
      ? settleIndex(searchInspire(query, inspireLimit), empty)
      : empty,
    specialty.has("eric")
      ? settleIndex(searchEric(query, ericLimit), empty)
      : empty,
  ]);

  const topicPapers =
    options.topicIds && options.topicIds.length > 0
      ? (
          await Promise.all(
            options.topicIds
              .slice(0, 3)
              .map((id) =>
                settleIndex(searchOpenAlexByTopic(id, topicPaperLimit), empty),
              ),
          )
        ).flat()
      : [];

  const firstWave = [
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
  ];
  const uniqueFirst = new Set(firstWave.map((paper) => paper.id));
  const related =
    uniqueFirst.size >= relatedSkipAfter
      ? empty
      : await settleIndex(
          fetchOpenAlexWorksByIds(oa.relatedIds.slice(0, relatedLimit)),
          empty,
        );

  return [...firstWave, ...related];
}
