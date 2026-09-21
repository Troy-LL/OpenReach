import type { Intent } from "./types.js";

const CS: readonly RegExp[] = [
  /\btransformers?\b/i,
  /\battention mechanism\b/i,
  /\bresidual (networks?|connections?|learning)\b/i,
  /\bdeep (image )?(networks?|models?|learning)\b/i,
  /\blanguage models?\b/i,
  /\bllms?\b/i,
  /\bcomputer vision\b/i,
  /\breinforcement learning\b/i,
  /\bcompilers?\b/i,
  /\boperating systems?\b/i,
  /\bdistributed systems?\b/i,
  /\b(typescript|javascript|gpu|cuda)\b/i,
];

const BIOMED: readonly RegExp[] = [
  /\bpatients?\b/i,
  /\bclinical\b/i,
  /\bcancers?\b/i,
  /\bgenes?\b/i,
  /\bproteins?\b/i,
  /\bdiseases?\b/i,
  /\bbiomedical\b/i,
  /\btherap(y|ies)\b/i,
  /\bdiagnos(is|es|tic)\b/i,
  /\brcts?\b/i,
];

const PHYSICS: readonly RegExp[] = [
  /\bneutrinos?\b/i,
  /\bcolliders?\b/i,
  /\bhadron\b/i,
  /\bquantum (gravity|field|chromodynamics|mechanics)\b/i,
  /\bspacetime\b/i,
  /\bastrophysics\b/i,
  /\bparticle physics\b/i,
  /\brelativity\b/i,
];

const SOCIAL: readonly RegExp[] = [
  /\bclassroom\b/i,
  /\bpedagogy\b/i,
  /\beducation policy\b/i,
  /\bsocioeconomic\b/i,
  /\bcurriculum\b/i,
];

const FIELD_PATTERNS: ReadonlyArray<{
  field: Exclude<Intent["field"], "other">;
  patterns: readonly RegExp[];
}> = [
  { field: "cs", patterns: CS },
  { field: "biomed", patterns: BIOMED },
  { field: "physics", patterns: PHYSICS },
  { field: "social", patterns: SOCIAL },
];

function hitCount(text: string, patterns: readonly RegExp[]): number {
  let n = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) n += 1;
  }
  return n;
}

/** Conservative local field guess. Mixed or unclear questions stay `other`. */
export function guessField(question: string): Intent["field"] {
  const text = question.trim();
  if (!text) return "other";

  const hits = FIELD_PATTERNS.filter(
    ({ patterns }) => hitCount(text, patterns) > 0,
  );
  if (hits.length !== 1) return "other";
  return hits[0].field;
}
