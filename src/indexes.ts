import type { Paper, PaperSource } from "./types.js";
import { authorsFromStringList, cleanAuthorNames, displayNameFromParts } from "./authors.js";
import { sanitizeSearchQuery } from "./query.js";
import { fetchUpstreamJson, fetchUpstreamText } from "./upstream.js";
const CROSSREF = "https://api.crossref.org/works";
const INSPIRE = "https://inspirehep.net/api/literature";
const ERIC = "https://api.ies.ed.gov/eric/";
const DOAJ = "https://doaj.org/api/search/articles";
const OPENAIRE = "https://api.openaire.eu/search/publications";
const PUBMED_SEARCH =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_FETCH =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const EUROPE_PMC =
  "https://www.ebi.ac.uk/europepmc/webservices/rest/search";
const PLOS = "https://api.plos.org/search";

export function stripMarkup(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const s = firstString(item);
      if (s) return s;
    }
    return "";
  }
  if (value && typeof value === "object" && "$" in value) {
    return firstString((value as { $: unknown }).$);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function yearFromParts(parts: unknown): number | null {
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const y = Number(parts[0]);
  return Number.isFinite(y) ? y : null;
}

export interface CrossrefWork {
  DOI?: string;
  title?: string[];
  abstract?: string;
  URL?: string;
  "container-title"?: string[];
  "published-print"?: { "date-parts"?: number[][] };
  "published-online"?: { "date-parts"?: number[][] };
  created?: { "date-parts"?: number[][] };
  author?: { given?: string; family?: string; name?: string }[];
}

export function parseCrossrefItems(items: CrossrefWork[]): Paper[] {
  return items
    .map((item): Paper | null => {
      const title = stripMarkup(item.title?.[0] ?? "");
      const abstract = stripMarkup(item.abstract ?? "");
      if (!title || !abstract) return null;
      const doi = item.DOI?.trim() || null;
      const year =
        yearFromParts(item["published-print"]?.["date-parts"]?.[0]) ??
        yearFromParts(item["published-online"]?.["date-parts"]?.[0]) ??
        yearFromParts(item.created?.["date-parts"]?.[0]);
      return {
        id: doi ? `doi:${doi.toLowerCase()}` : `crossref:${title}`,
        title,
        abstract,
        year,
        venue: item["container-title"]?.[0] ?? "Crossref",
        doi,
        url: item.URL ?? (doi ? `https://doi.org/${doi}` : null),
        source: "crossref",
        authors: authorsFromStringList(item.author),
      };
    })
    .filter((p): p is Paper => p !== null);
}

export function parsePubmedXml(xml: string): Paper[] {
  const articles = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/gi) ?? [];
  const papers: Paper[] = [];

  for (const block of articles) {
    const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/i)?.[1];
    if (!pmid) continue;
    const title = stripMarkup(
      block.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/i)?.[1] ?? "",
    );
    const abstractParts = [
      ...(block.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi) ?? []),
    ].map((tag) =>
      stripMarkup(tag.replace(/<\/?AbstractText[^>]*>/gi, "")),
    );
    const abstract = abstractParts.join(" ").trim();
    if (!title || !abstract) continue;

    const yearRaw =
      block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/i)?.[1] ??
      block.match(/<ArticleDate[\s\S]*?<Year>(\d{4})<\/Year>/i)?.[1];
    const doi =
      block.match(
        /<ELocationID[^>]*EIdType="doi"[^>]*>([^<]+)<\/ELocationID>/i,
      )?.[1]?.trim() ??
      block.match(
        /<ArticleId[^>]*IdType="doi"[^>]*>([^<]+)<\/ArticleId>/i,
      )?.[1]?.trim() ??
      null;
    const venue = stripMarkup(
      block.match(/<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/i)?.[1] ??
        "PubMed",
    );
    const authors = cleanAuthorNames(
      (block.match(/<Author\b[\s\S]*?<\/Author>/gi) ?? []).map((authorBlock) => {
        const last = stripMarkup(
          authorBlock.match(/<LastName>([\s\S]*?)<\/LastName>/i)?.[1] ?? "",
        );
        const fore = stripMarkup(
          authorBlock.match(/<ForeName>([\s\S]*?)<\/ForeName>/i)?.[1] ?? "",
        );
        const collective = stripMarkup(
          authorBlock.match(/<CollectiveName>([\s\S]*?)<\/CollectiveName>/i)?.[1] ??
            "",
        );
        return displayNameFromParts(fore, last, collective);
      }),
    );

    papers.push({
      id: `pmid:${pmid}`,
      title,
      abstract,
      year: yearRaw ? Number(yearRaw) : null,
      venue: venue || "PubMed",
      doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      source: "pubmed",
      authors,
    });
  }

  return papers;
}

export interface InspireHit {
  id?: number | string;
  metadata?: {
    titles?: { title?: string }[];
    abstracts?: { value?: string }[];
    dois?: { value?: string }[];
    publication_info?: { journal_title?: string; year?: number }[];
    earliest_date?: string;
    authors?: { full_name?: string; first_name?: string; last_name?: string }[];
  };
}

export function parseInspireHits(hits: InspireHit[]): Paper[] {
  return hits
    .map((hit): Paper | null => {
      const meta = hit.metadata ?? {};
      const title = (meta.titles?.[0]?.title ?? "").trim();
      const abstract = (meta.abstracts?.[0]?.value ?? "").trim();
      if (!title || !abstract) return null;
      const doi = meta.dois?.[0]?.value?.trim() || null;
      const pub = meta.publication_info?.[0];
      const year =
        pub?.year ??
        (meta.earliest_date
          ? Number(meta.earliest_date.slice(0, 4)) || null
          : null);
      const id = hit.id != null ? String(hit.id) : title;
      return {
        id: `inspire:${id}`,
        title,
        abstract,
        year,
        venue: pub?.journal_title ?? "INSPIRE-HEP",
        doi,
        url: doi
          ? `https://doi.org/${doi}`
          : `https://inspirehep.net/literature/${id}`,
        source: "inspire",
        authors: authorsFromStringList(meta.authors),
      };
    })
    .filter((p): p is Paper => p !== null);
}

export interface EricDoc {
  id?: string;
  title?: string;
  description?: string;
  publicationdateyear?: number | string;
  source?: string;
  isbn?: string | string[];
  issn?: string | string[];
  url?: string[];
  doi?: string[];
  author?: string | string[];
}

export function parseEricDocs(docs: EricDoc[]): Paper[] {
  return docs
    .map((doc): Paper | null => {
      const title = (doc.title ?? "").trim();
      const abstract = (doc.description ?? "").trim();
      if (!title || !abstract) return null;
      const id = (doc.id ?? title).trim();
      const yearRaw =
        doc.publicationdateyear != null
          ? Number(doc.publicationdateyear)
          : NaN;
      const doi = Array.isArray(doc.doi) ? doc.doi[0] : undefined;
      const url = Array.isArray(doc.url) ? doc.url[0] : undefined;
      return {
        id: `eric:${id}`,
        title,
        abstract,
        year: Number.isFinite(yearRaw) ? yearRaw : null,
        venue: doc.source ?? "ERIC",
        doi: doi?.trim() || null,
        url:
          url ??
          `https://eric.ed.gov/?id=${encodeURIComponent(id)}`,
        source: "eric",
        authors: authorsFromStringList(doc.author),
      };
    })
    .filter((p): p is Paper => p !== null);
}

export interface DoajHit {
  bibjson?: {
    title?: string;
    abstract?: string;
    year?: string | number;
    journal?: { title?: string };
    identifier?: { id?: string; type?: string }[];
    link?: { url?: string; type?: string }[];
    author?: { name?: string }[];
  };
}

export function parseDoajResults(results: DoajHit[]): Paper[] {
  return results
    .map((hit): Paper | null => {
      const bib = hit.bibjson ?? {};
      const title = (bib.title ?? "").trim();
      const abstract = (bib.abstract ?? "").trim();
      if (!title || !abstract) return null;
      const doi =
        bib.identifier?.find((i) => i.type?.toLowerCase() === "doi")?.id ??
        null;
      const yearRaw = bib.year != null ? Number(bib.year) : NaN;
      const url =
        bib.link?.find((l) => l.type === "fulltext")?.url ??
        bib.link?.[0]?.url ??
        (doi ? `https://doi.org/${doi}` : null);
      return {
        id: doi ? `doi:${doi.toLowerCase()}` : `doaj:${title}`,
        title,
        abstract,
        year: Number.isFinite(yearRaw) ? yearRaw : null,
        venue: bib.journal?.title ?? "DOAJ",
        doi,
        url,
        source: "doaj",
        authors: authorsFromStringList(bib.author),
      };
    })
    .filter((p): p is Paper => p !== null);
}

export interface OpenAireResult {
  metadata?: {
    "oaf:entity"?: {
      "oaf:result"?: Record<string, unknown>;
    };
  };
}

function openAirePid(
  pid: unknown,
  classId: string,
): string | null {
  const list = Array.isArray(pid) ? pid : pid ? [pid] : [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (String(rec["@classid"] ?? "").toLowerCase() === classId) {
      const v = firstString(rec.$);
      if (v) return v;
    }
  }
  return null;
}

export function parseOpenAireResults(results: OpenAireResult[]): Paper[] {
  return results
    .map((result): Paper | null => {
      const ent = result.metadata?.["oaf:entity"]?.["oaf:result"];
      if (!ent) return null;
      const title = stripMarkup(firstString(ent.title));
      const abstract = stripMarkup(firstString(ent.description));
      if (!title || !abstract) return null;
      if (/unavailable due to conflicting licenses/i.test(abstract)) {
        return null;
      }
      const doi = openAirePid(ent.pid, "doi");
      const pmid = openAirePid(ent.pid, "pmid");
      const date = firstString(ent.dateofacceptance);
      const year = date ? Number(date.slice(0, 4)) || null : null;
      const venue = firstString(ent.journal) || firstString(ent.publisher) || "OpenAIRE";
      const id = doi
        ? `doi:${doi.toLowerCase()}`
        : pmid
          ? `pmid:${pmid}`
          : `openaire:${title}`;
      return {
        id,
        title,
        abstract,
        year,
        venue,
        doi,
        url: doi
          ? `https://doi.org/${doi}`
          : pmid
            ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
            : null,
        source: "openaire",
        authors: authorsFromStringList(ent.creator),
      };
    })
    .filter((p): p is Paper => p !== null);
}

export interface PreprintHit {
  id?: string;
  title?: string;
  abstractText?: string;
  pubYear?: string | number;
  journalTitle?: string;
  doi?: string;
  source?: string;
  authorString?: string;
}

function preprintSource(hit: PreprintHit): PaperSource | null {
  const journal = (hit.journalTitle ?? "").toLowerCase();
  const doi = (hit.doi ?? "").toLowerCase();
  if (journal.includes("medrxiv")) return "medrxiv";
  if (journal.includes("biorxiv")) return "biorxiv";
  if (/10\.1101\/\d{4}\.\d{2}\.\d{2}\.\d{8}/.test(doi)) return "medrxiv";
  if (doi.startsWith("10.1101/")) return "biorxiv";
  return null;
}

export function parsePreprintHits(hits: PreprintHit[]): Paper[] {
  return hits
    .map((hit): Paper | null => {
      const title = (hit.title ?? "").trim();
      const abstract = (hit.abstractText ?? "").trim();
      if (!title || !abstract) return null;
      const source = preprintSource(hit);
      if (!source) return null;
      const doi = hit.doi?.trim() || null;
      const yearRaw = hit.pubYear != null ? Number(hit.pubYear) : NaN;
      const id = hit.id ? `ppr:${hit.id}` : doi ? `doi:${doi.toLowerCase()}` : `ppr:${title}`;
      const host = source === "medrxiv" ? "www.medrxiv.org" : "www.biorxiv.org";
      return {
        id,
        title,
        abstract,
        year: Number.isFinite(yearRaw) ? yearRaw : null,
        venue: source === "medrxiv" ? "medRxiv" : "bioRxiv",
        doi,
        url: doi
          ? `https://${host}/content/${doi}`
          : `https://${host}/`,
        source,
        authors: authorsFromStringList(hit.authorString),
      };
    })
    .filter((p): p is Paper => p !== null);
}

async function getJson<T>(url: string): Promise<T | null> {
  return fetchUpstreamJson<T>(url);
}

export async function searchCrossref(
  query: string,
  rows = 25,
): Promise<Paper[]> {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  const url =
    `${CROSSREF}?query=${encodeURIComponent(q)}` +
    `&rows=${rows}&filter=has-abstract:true` +
    `&select=DOI,title,abstract,published-print,published-online,created,container-title,URL`;
  const data = await getJson<{
    message?: { items?: CrossrefWork[] };
  }>(url);
  return parseCrossrefItems(data?.message?.items ?? []);
}

export async function searchPubmed(
  query: string,
  retmax = 25,
): Promise<Paper[]> {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  const searchUrl =
    `${PUBMED_SEARCH}?db=pubmed&term=${encodeURIComponent(q)}` +
    `&retmax=${retmax}&retmode=json`;
  const search = await getJson<{
    esearchresult?: { idlist?: string[] };
  }>(searchUrl);
  const ids = search?.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  const fetchUrl =
    `${PUBMED_FETCH}?db=pubmed&id=${ids.join(",")}&retmode=xml`;
  const xml = await fetchUpstreamText(fetchUrl, { Accept: "application/xml" });
  if (!xml) return [];
  return parsePubmedXml(xml);
}

export async function searchInspire(
  query: string,
  size = 25,
): Promise<Paper[]> {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  const url =
    `${INSPIRE}?q=${encodeURIComponent(q)}&size=${size}` +
    `&fields=titles,abstracts,dois,publication_info,earliest_date`;
  const data = await getJson<{ hits?: { hits?: InspireHit[] } }>(url);
  return parseInspireHits(data?.hits?.hits ?? []);
}

export async function searchEric(
  query: string,
  rows = 25,
): Promise<Paper[]> {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  const url =
    `${ERIC}?search=${encodeURIComponent(q)}&format=json&rows=${rows}`;
  const data = await getJson<{
    response?: { docs?: EricDoc[] };
  }>(url);
  return parseEricDocs(data?.response?.docs ?? []);
}

export async function searchDoaj(
  query: string,
  pageSize = 25,
): Promise<Paper[]> {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  const url = `${DOAJ}/${encodeURIComponent(q)}?pageSize=${pageSize}`;
  const data = await getJson<{ results?: DoajHit[] }>(url);
  return parseDoajResults(data?.results ?? []);
}

export async function searchOpenAire(
  query: string,
  size = 25,
): Promise<Paper[]> {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  const url =
    `${OPENAIRE}?keywords=${encodeURIComponent(q)}` +
    `&size=${size}&format=json`;
  const data = await getJson<{
    response?: { results?: { result?: OpenAireResult | OpenAireResult[] } };
  }>(url);
  const raw = data?.response?.results?.result;
  const results = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
  return parseOpenAireResults(results);
}

export async function searchLifeSciencePreprints(
  query: string,
  pageSize = 25,
): Promise<Paper[]> {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  const url =
    `${EUROPE_PMC}?query=${encodeURIComponent(
      `(JOURNAL:"bioRxiv" OR JOURNAL:"medRxiv") AND ${q}`,
    )}` + `&format=json&pageSize=${pageSize}&resultType=core`;
  const data = await getJson<{
    resultList?: { result?: PreprintHit[] };
  }>(url);
  const parsed = parsePreprintHits(data?.resultList?.result ?? []);
  if (parsed.length > 0) return parsed;

  const fallbackUrl =
    `${EUROPE_PMC}?query=${encodeURIComponent(`SRC:PPR AND ${q}`)}` +
    `&format=json&pageSize=${pageSize}&resultType=core`;
  const fallback = await getJson<{
    resultList?: { result?: PreprintHit[] };
  }>(fallbackUrl);
  return parsePreprintHits(fallback?.resultList?.result ?? []);
}

export interface PlosDoc {
  id?: string;
  title?: string;
  abstract?: string[];
  publication_date?: string;
  journal?: string;
  author_display?: string[];
}

export function parsePlosDocs(docs: PlosDoc[]): Paper[] {
  return docs
    .map((doc): Paper | null => {
      const title = stripMarkup(doc.title ?? "");
      const abstract = stripMarkup((doc.abstract ?? []).join(" "));
      if (!title || !abstract) return null;
      const doi = doc.id?.trim() || null;
      const yearRaw = doc.publication_date
        ? Number(doc.publication_date.slice(0, 4))
        : NaN;
      return {
        id: doi ? `doi:${doi.toLowerCase()}` : `plos:${title}`,
        title,
        abstract,
        year: Number.isFinite(yearRaw) ? yearRaw : null,
        venue: doc.journal ?? "PLOS",
        doi,
        url: doi ? `https://doi.org/${doi}` : null,
        source: "plos",
        authors: authorsFromStringList(doc.author_display),
      };
    })
    .filter((p): p is Paper => p !== null);
}

export async function searchPlos(
  query: string,
  rows = 25,
): Promise<Paper[]> {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];
  const url =
    `${PLOS}?q=${encodeURIComponent(q)}` +
    `&fl=id,title,abstract,publication_date,journal,author_display&rows=${rows}&wt=json`;
  const data = await getJson<{
    response?: { docs?: PlosDoc[] };
  }>(url);
  return parsePlosDocs(data?.response?.docs ?? []);
}
