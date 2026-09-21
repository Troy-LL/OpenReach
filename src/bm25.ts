export const DEFAULT_BM25_CAP = 200;
export const DEFAULT_BM25_MIN_SCORE = 0;

const K1 = 1.2;
const B = 0.75;
/** Title terms count this many times toward TF (repeat-twice equivalent). */
const TITLE_TERM_WEIGHT = 2;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

function titleAndAbstractTokens(
  title: string,
  abstract: string,
): { titleTokens: string[]; abstractTokens: string[]; weightedLength: number } {
  const titleTokens = tokenize(title);
  const abstractTokens = tokenize(abstract);
  const weightedLength =
    titleTokens.length * TITLE_TERM_WEIGHT + abstractTokens.length;
  return { titleTokens, abstractTokens, weightedLength };
}

function weightedTermFrequency(
  titleTokens: string[],
  abstractTokens: string[],
  term: string,
): number {
  return (
    TITLE_TERM_WEIGHT * termFrequency(titleTokens, term) +
    termFrequency(abstractTokens, term)
  );
}

function termFrequency(tokens: string[], term: string): number {
  let count = 0;
  for (const t of tokens) {
    if (t === term) count++;
  }
  return count;
}

function idf(df: number, n: number): number {
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

type DocFields = {
  titleTokens: string[];
  abstractTokens: string[];
  weightedLength: number;
};

function averageDocumentLength(corpus: DocFields[]): number {
  if (corpus.length === 0) return 0;
  let total = 0;
  for (const doc of corpus) {
    total += doc.weightedLength;
  }
  return total / corpus.length;
}

function corpusContainsTerm(doc: DocFields, term: string): boolean {
  return (
    doc.titleTokens.includes(term) || doc.abstractTokens.includes(term)
  );
}

function scoreDocument(
  queryTokens: string[],
  doc: DocFields,
  corpus: DocFields[],
): number {
  const n = corpus.length;
  if (n === 0 || queryTokens.length === 0) return 0;

  const avgdl = averageDocumentLength(corpus);
  const docLen = doc.weightedLength;
  const norm = avgdl > 0 ? 1 - B + B * (docLen / avgdl) : 1;

  const seen = new Set<string>();
  let score = 0;

  for (const term of queryTokens) {
    if (seen.has(term)) continue;
    seen.add(term);

    const tf = weightedTermFrequency(doc.titleTokens, doc.abstractTokens, term);
    if (tf === 0) continue;

    let df = 0;
    for (const other of corpus) {
      if (corpusContainsTerm(other, term)) df++;
    }
    const termIdf = idf(df, n);
    const tfNorm = (tf * (K1 + 1)) / (tf + K1 * norm);
    score += termIdf * tfNorm;
  }

  return score;
}

export function bm25Score(
  query: string,
  title: string,
  abstract: string,
): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const doc = titleAndAbstractTokens(title, abstract);
  const corpus = [doc];
  return scoreDocument(queryTokens, doc, corpus);
}

export function gateByBm25<T extends { title: string; abstract: string }>(
  query: string,
  papers: T[],
  options?: { minScore?: number; cap?: number },
): T[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || papers.length === 0) return [];

  const minScore = options?.minScore ?? DEFAULT_BM25_MIN_SCORE;
  const cap = options?.cap ?? DEFAULT_BM25_CAP;

  const corpus = papers.map((p) =>
    titleAndAbstractTokens(p.title, p.abstract),
  );

  const scored = papers.map((paper, index) => ({
    paper,
    index,
    score: scoreDocument(queryTokens, corpus[index], corpus),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  const filtered =
    minScore > 0
      ? scored.filter((row) => row.score >= minScore)
      : scored;

  return filtered.slice(0, cap).map((row) => row.paper);
}
