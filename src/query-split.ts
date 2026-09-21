import type { RecencyNeed } from "./types.js";

export type { RecencyNeed };

export interface QueryFacets {
  problem: string;
  method: string | null;
  population: string | null;
  constraints: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  recency: RecencyNeed;
}

const RECENCY_ANCHOR_YEAR = 2026;

const METHOD_PATTERNS: ReadonlyArray<{ pattern: RegExp; hint: string }> = [
  { pattern: /\bmeta-analysis\b/i, hint: "meta-analysis" },
  { pattern: /\brandomized\b/i, hint: "randomized" },
  { pattern: /\bRCTs?\b/i, hint: "RCT" },
  { pattern: /\bsurvey\b/i, hint: "survey" },
  { pattern: /\bqualitative\b/i, hint: "qualitative" },
  { pattern: /\btransformer\b/i, hint: "transformer" },
  { pattern: /\bresidual\b/i, hint: "residual" },
  { pattern: /\bCRISPR\b/i, hint: "CRISPR" },
  { pattern: /\binterview\b/i, hint: "interview" },
];

const POPULATION_PATTERNS: ReadonlyArray<{ pattern: RegExp; hint: string }> = [
  { pattern: /\bsmartphone users\b/i, hint: "smartphone users" },
  { pattern: /\bpatients\b/i, hint: "patients" },
  { pattern: /\bclinicians\b/i, hint: "clinicians" },
  { pattern: /\bstudents\b/i, hint: "students" },
  { pattern: /\bmice\b/i, hint: "mice" },
];

const CONSTRAINT_PATTERNS: ReadonlyArray<{ pattern: RegExp; hint: string }> = [
  { pattern: /\breview only\b/i, hint: "review only" },
  { pattern: /\bopen access\b/i, hint: "open access" },
];

const EMPTY_FACETS: QueryFacets = {
  problem: "",
  method: null,
  population: null,
  constraints: null,
  yearFrom: null,
  yearTo: null,
  recency: "any",
};

function firstMatch(
  text: string,
  patterns: ReadonlyArray<{ pattern: RegExp; hint: string }>,
): string | null {
  for (const { pattern, hint } of patterns) {
    if (pattern.test(text)) {
      return hint;
    }
  }
  return null;
}

function parseYearWindow(text: string): {
  yearFrom: number | null;
  yearTo: number | null;
} {
  const range = /\bfrom\s+(19\d{2}|20\d{2})\s+to\s+(19\d{2}|20\d{2})\b/i.exec(
    text,
  );
  if (range) {
    return {
      yearFrom: Number.parseInt(range[1], 10),
      yearTo: Number.parseInt(range[2], 10),
    };
  }

  const since = /\bsince\s+(19\d{2}|20\d{2})\b/i.exec(text);
  if (since) {
    return { yearFrom: Number.parseInt(since[1], 10), yearTo: null };
  }

  const lastYears = /\blast\s+(\d+)\s+years?\b/i.exec(text);
  if (lastYears) {
    const span = Number.parseInt(lastYears[1], 10);
    if (span > 0) {
      return {
        yearFrom: RECENCY_ANCHOR_YEAR - span + 1,
        yearTo: RECENCY_ANCHOR_YEAR,
      };
    }
  }

  const inYear = /\bin\s+(19\d{2}|20\d{2})\b/i.exec(text);
  if (inYear) {
    const year = Number.parseInt(inYear[1], 10);
    return { yearFrom: year, yearTo: year };
  }

  return { yearFrom: null, yearTo: null };
}

function parseRecency(text: string): RecencyNeed {
  if (/\b(historical|classic|foundational)\b/i.test(text)) {
    return "historical";
  }
  if (
    /\blast\s+\d+\s+years?\b/i.test(text) ||
    /\bsince\s+(19\d{2}|20\d{2})\b/i.test(text) ||
    /\brecent\b/i.test(text) ||
    /\bpast decade\b/i.test(text)
  ) {
    return "recent";
  }
  return "any";
}

export function splitQuery(question: string): QueryFacets {
  const problem = question.trim();
  if (problem.length === 0) {
    return { ...EMPTY_FACETS };
  }

  const { yearFrom, yearTo } = parseYearWindow(problem);

  return {
    problem,
    method: firstMatch(problem, METHOD_PATTERNS),
    population: firstMatch(problem, POPULATION_PATTERNS),
    constraints: firstMatch(problem, CONSTRAINT_PATTERNS),
    yearFrom,
    yearTo,
    recency: parseRecency(problem),
  };
}
