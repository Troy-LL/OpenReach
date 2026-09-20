import type { Paper } from "./types.js";
import { sanitizeSearchQuery } from "./query.js";

const USER_AGENT = "openreach/0.1 (research; mailto:openreach@localhost)";
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

    papers.push({
      id: `arxiv:${arxivId}`,
      title,
      abstract,
      year,
      venue: "arXiv",
      doi: `10.48550/arXiv.${arxivId}`,
      url: `https://arxiv.org/abs/${arxivId}`,
      source: "arxiv",
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
}

export function parseEuropePmcResults(hits: EuropePmcHit[]): Paper[] {
  return hits
    .map((h): Paper | null => {
      const title = (h.title ?? "").trim();
      const abstract = (h.abstractText ?? "").trim();
      if (!title || !abstract) return null;

      const doi = h.doi?.trim() || null;
      const yearRaw = h.pubYear != null ? Number(h.pubYear) : NaN;
      const id = h.pmid
        ? `pmid:${h.pmid}`
        : h.pmcid
          ? `pmc:${h.pmcid}`
          : `epmc:${h.id ?? title}`;

      return {
        id,
        title,
        abstract,
        year: Number.isFinite(yearRaw) ? yearRaw : null,
        venue: h.journalTitle ?? "Europe PMC",
        doi,
        url: h.pmid
          ? `https://europepmc.org/article/MED/${h.pmid}`
          : doi
            ? `https://doi.org/${doi}`
            : `https://europepmc.org/search?query=${encodeURIComponent(title)}`,
        source: "europe_pmc",
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

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/atom+xml" },
  });
  if (res.status === 429) return [];
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} for arXiv${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }
  return parseArxivAtom(await res.text());
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

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (res.status === 429) return [];
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} for Europe PMC${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await res.json()) as {
    resultList?: { result?: EuropePmcHit[] };
  };
  return parseEuropePmcResults(data.resultList?.result ?? []);
}
