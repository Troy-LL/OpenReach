import type { Paper } from "./types.js";
import { authorsFromStringList } from "./authors.js";
import { normalizePmcid, resolvePaperUrl } from "./paper-url.js";
import { sanitizeSearchQuery } from "./query.js";
import { fetchUpstreamJson, fetchUpstreamText } from "./upstream.js";
const ARXIV = "https://export.arxiv.org/api/query";
const EUROPE_PMC =
  "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i");
  const m = block.match(re);
  return m ? decodeXml(m[1]) : "";
}

/** Normalize arXiv abs ids like http://arxiv.org/abs/1512.03385v1 → 1512.03385 */
export function normalizeArxivId(raw: string): string | null {
  const m = raw.match(
    /(?:arxiv\.org\/abs\/|arxiv:)?(\d{4}\.\d{4,5})(?:v\d+)?/i,
  );
  return m ? m[1] : null;
}

export function parseArxivAtom(xml: string): Paper[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) ?? [];
  const papers: Paper[] = [];

  for (const entry of entries) {
    const idRaw = tag(entry, "id");
    const arxivId = normalizeArxivId(idRaw);
    if (!arxivId) continue;

    const title = tag(entry, "title");
    const abstract = tag(entry, "summary");
    const published = tag(entry, "published");
    const year = published ? Number(published.slice(0, 4)) || null : null;
    const authors = authorsFromStringList(
      [...entry.matchAll(/<author\b[^>]*>[\s\S]*?<name\b[^>]*>([\s\S]*?)<\/name>/gi)].map(
        (m) => decodeXml(m[1]),
      ),
    );

    papers.push({
      id: `arxiv:${arxivId}`,
      title,
      abstract,
      year,
      venue: "arXiv",
      doi: `10.48550/arXiv.${arxivId}`,
      url: `https://arxiv.org/abs/${arxivId}`,
      source: "arxiv",
      authors,
    });
  }

  return papers;
}

interface EuropePmcHit {
  id?: string;
  title?: string;
  abstractText?: string;
  pubYear?: string | number;
  journalTitle?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  source?: string;
  authorString?: string;
  authorList?: {
    author?:
      | { fullName?: string; firstName?: string; lastName?: string }
      | Array<{ fullName?: string; firstName?: string; lastName?: string }>;
  };
}

export function parseEuropePmcResults(hits: EuropePmcHit[]): Paper[] {
  return hits
    .map((h): Paper | null => {
      const title = (h.title ?? "").trim();
      const abstract = (h.abstractText ?? "").trim();
      if (!title || !abstract) return null;

      const doi = h.doi?.trim() || null;
      const yearRaw = h.pubYear != null ? Number(h.pubYear) : NaN;
      const pmcid = h.pmcid?.trim() ? normalizePmcid(h.pmcid) : null;
      const id = h.pmid
        ? `pmid:${h.pmid}`
        : pmcid
          ? `pmc:${pmcid}`
          : `epmc:${h.id ?? title}`;

      return {
        id,
        title,
        abstract,
        year: Number.isFinite(yearRaw) ? yearRaw : null,
        venue: h.journalTitle ?? "Europe PMC",
        doi,
        url:
          resolvePaperUrl(
            [
              pmcid ? `https://europepmc.org/articles/${pmcid}` : null,
              h.pmid ? `https://europepmc.org/article/MED/${h.pmid}` : null,
            ],
            doi,
          ) ??
          `https://europepmc.org/search?query=${encodeURIComponent(title)}`,
        source: "europe_pmc",
        authors: authorsFromStringList(
          h.authorList?.author ?? h.authorString,
        ),
      };
    })
    .filter((p): p is Paper => p !== null);
}

/** Build arXiv all: query with AND between tokens (spaces alone are treated oddly). */
export function arxivSearchQuery(query: string): string {
  const words = sanitizeSearchQuery(query)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  if (words.length === 0) return "";
  if (words.length === 1) return `all:${encodeURIComponent(words[0])}`;
  return words.map((w) => `all:${encodeURIComponent(w)}`).join("+AND+");
}

export async function searchArxiv(
  query: string,
  maxResults = 25,
): Promise<Paper[]> {
  const searchQuery = arxivSearchQuery(query);
  if (!searchQuery) return [];

  const url =
    `${ARXIV}?search_query=${searchQuery}` +
    `&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

  const xml = await fetchUpstreamText(url, { Accept: "application/atom+xml" });
  if (!xml) return [];
  return parseArxivAtom(xml);
}

export async function searchEuropePmc(
  query: string,
  pageSize = 25,
): Promise<Paper[]> {
  const q = sanitizeSearchQuery(query);
  if (!q) return [];

  const url =
    `${EUROPE_PMC}?query=${encodeURIComponent(q)}` +
    `&format=json&pageSize=${pageSize}&resultType=core`;

  const data = await fetchUpstreamJson<{
    resultList?: { result?: EuropePmcHit[] };
  }>(url);
  return parseEuropePmcResults(data?.resultList?.result ?? []);
}
