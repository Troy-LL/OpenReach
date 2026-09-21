export type Citeable = {
  id: string;
  title: string;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  authors?: string[] | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
};

function normalizeAuthors(authors: string[] | null | undefined): string[] {
  if (!authors || authors.length === 0) {
    return [];
  }
  return authors.map((name) => {
    const trimmed = name.trim();
    if (trimmed.includes(",")) {
      return trimmed;
    }
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace <= 0) {
      return trimmed;
    }
    const last = trimmed.slice(lastSpace + 1);
    const first = trimmed.slice(0, lastSpace);
    return `${last}, ${first}`;
  });
}

function formatAuthorSegment(authors: string[]): string {
  if (authors.length === 0) {
    return "[Author unknown]";
  }
  if (authors.length === 1) {
    return authors[0];
  }
  if (authors.length === 2) {
    return `${authors[0]}, & ${authors[1]}`;
  }
  const allButLast = authors.slice(0, -1).join(", ");
  return `${allButLast}, & ${authors[authors.length - 1]}`;
}

function formatYear(year: number | null): string {
  return year === null ? "(n.d.)" : `(${year})`;
}

function formatPublicationTail(paper: Citeable): string {
  const parts: string[] = [];
  if (paper.venue) {
    let venuePart = paper.venue;
    if (paper.volume) {
      venuePart += `, ${paper.volume}`;
      if (paper.issue) {
        venuePart += `(${paper.issue})`;
      }
    }
    if (paper.pages) {
      venuePart += paper.volume ? `, ${paper.pages}` : `. ${paper.pages}`;
    }
    parts.push(venuePart);
  } else if (paper.pages) {
    parts.push(paper.pages);
  }
  return parts.join(". ");
}

function formatLink(paper: Citeable): string | null {
  if (paper.doi) {
    const doi = paper.doi.replace(/^https?:\/\/doi\.org\//i, "");
    return `https://doi.org/${doi}`;
  }
  if (paper.url) {
    return paper.url;
  }
  return null;
}

export function formatApa(paper: Citeable): string {
  const authors = normalizeAuthors(paper.authors);
  const authorPart = formatAuthorSegment(authors);
  const yearPart = formatYear(paper.year);
  const segments: string[] = [
    `${authorPart}. ${yearPart}. ${paper.title}`,
  ];

  const tail = formatPublicationTail(paper);
  if (tail) {
    segments.push(tail);
  }

  const link = formatLink(paper);
  if (link) {
    segments.push(link);
  }

  return segments.join(". ");
}

function alphanumericsOnly(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "");
}

function firstTitleWord(title: string): string {
  const match = title.match(/[a-zA-Z0-9]+/);
  return match ? match[0] : "untitled";
}

function bibtexAuthorKey(authors: string[] | null | undefined): string | null {
  if (!authors || authors.length === 0) {
    return null;
  }
  const first = authors[0].trim();
  if (first.includes(",")) {
    const last = first.split(",")[0].trim();
    const token = alphanumericsOnly(last);
    return token || null;
  }
  const lastSpace = first.lastIndexOf(" ");
  const last = lastSpace > 0 ? first.slice(lastSpace + 1) : first;
  const token = alphanumericsOnly(last);
  return token || null;
}

export function bibtexCiteKey(paper: Citeable): string {
  const authorPart = bibtexAuthorKey(paper.authors);
  const yearPart = paper.year !== null ? String(paper.year) : "nd";
  const titlePart = alphanumericsOnly(firstTitleWord(paper.title));

  if (authorPart) {
    return `${authorPart}${yearPart}${titlePart}`;
  }
  const idPart = alphanumericsOnly(paper.id);
  if (idPart) {
    return `${idPart}${yearPart}${titlePart}`;
  }
  return `cite${yearPart}${titlePart}`;
}

function escapeBibtexValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}");
}

function bibtexAuthors(authors: string[] | null | undefined): string | null {
  const normalized = normalizeAuthors(authors);
  if (normalized.length === 0) {
    return null;
  }
  return normalized.join(" and ");
}

function bibtexDoi(paper: Citeable): string | null {
  if (!paper.doi) {
    return null;
  }
  return paper.doi.replace(/^https?:\/\/doi\.org\//i, "");
}

export function formatBibtex(paper: Citeable): string {
  const entryType = paper.venue ? "article" : "misc";
  const key = bibtexCiteKey(paper);
  const fields: string[] = [];

  const author = bibtexAuthors(paper.authors);
  if (author) {
    fields.push(`  author = {${escapeBibtexValue(author)}}`);
  }

  fields.push(`  title = {${escapeBibtexValue(paper.title)}}`);

  if (paper.year !== null) {
    fields.push(`  year = {${paper.year}}`);
  }

  if (paper.venue) {
    fields.push(`  journal = {${escapeBibtexValue(paper.venue)}}`);
  }

  if (paper.volume) {
    fields.push(`  volume = {${escapeBibtexValue(paper.volume)}}`);
  }

  if (paper.issue) {
    fields.push(`  number = {${escapeBibtexValue(paper.issue)}}`);
  }

  if (paper.pages) {
    fields.push(`  pages = {${escapeBibtexValue(paper.pages)}}`);
  }

  const doi = bibtexDoi(paper);
  if (doi) {
    fields.push(`  doi = {${escapeBibtexValue(doi)}}`);
  } else if (paper.url) {
    fields.push(`  url = {${escapeBibtexValue(paper.url)}}`);
  }

  return `@${entryType}{${key},\n${fields.join(",\n")}\n}`;
}

export function formatApaList(papers: Citeable[]): string {
  return papers.map(formatApa).join("\n");
}

export function formatBibtexList(papers: Citeable[]): string {
  return papers.map(formatBibtex).join("\n\n");
}
