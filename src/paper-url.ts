/** Blog / newsletter hosts that should not be paper outbound links. */
const DEMOTED_HOST_SUFFIXES = [
  "medium.com",
  "towardsdatascience.com",
  "substack.com",
  "wordpress.com",
  "blogspot.com",
  "semanticscholar.org",
] as const;

export function normalizeDoi(doi: string): string {
  return doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
}

export function normalizePmcid(raw: string): string {
  const digits = raw.trim().replace(/^pmc/i, "");
  return `PMC${digits}`;
}

function hostnameOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isOpenAlexWorkUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    return host === "openalex.org" && /^\/W\d+/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function isDemotedPaperHost(raw: string): boolean {
  const host = hostnameOf(raw);
  if (!host) return true;
  return DEMOTED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/**
 * First usable scholarly/OA candidate, else doi.org/{doi}, else null.
 * Never returns an OpenAlex work id or a Medium-class blog URL.
 */
export function resolvePaperUrl(
  candidates: Array<string | null | undefined>,
  doi?: string | null,
): string | null {
  for (const raw of candidates) {
    const url = typeof raw === "string" ? raw.trim() : "";
    if (!url) continue;
    if (isOpenAlexWorkUrl(url)) continue;
    if (isDemotedPaperHost(url)) continue;
    try {
      new URL(url);
    } catch {
      continue;
    }
    return url;
  }
  const cleaned = doi ? normalizeDoi(doi) : "";
  return cleaned ? `https://doi.org/${cleaned}` : null;
}
