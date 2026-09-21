import { noul, score, TypeSafeClient } from "@typesafe-ai/sdk";
import { cacheKey, TtlLruCache } from "./cache.js";
import {
  compositeScore,
  EVIDENCE_LEGENDS,
  METHOD_LEGENDS,
  POPULATION_LEGENDS,
  RECENCY_LEGENDS,
  topicRelevance,
} from "./score.js";
import type { Intent, Paper, RankedPaper, ScoreContext } from "./types.js";

type CachedDims = Pick<
  RankedPaper,
  "method" | "population" | "evidence" | "recency" | "isReview"
>;

const scoreCache = new TtlLruCache<CachedDims>(2000, 60 * 60 * 1000);

export function scoreCacheSize(): number {
  return scoreCache.size;
}

export function clearScoreCache(): void {
  scoreCache.clear();
}

function paperScoreKey(
  question: string,
  paper: Paper,
  context?: ScoreContext,
): string {
  return cacheKey([
    question,
    paper.doi ?? paper.id,
    context?.methodNeed ?? "",
    context?.populationNeed ?? "",
    context?.recencyNeed ?? "any",
    context?.likeTitle ?? "",
    context?.likeAbstract ?? "",
  ]);
}

const CONCURRENCY = 8;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function scorePaper(
  client: TypeSafeClient,
  question: string,
  paper: Paper,
  context?: ScoreContext,
): Promise<CachedDims> {
  const key = paperScoreKey(question, paper, context);
  const cached = scoreCache.get(key);
  if (cached) return cached;

  const { answers } = await client.systemOne({
    state: {
      question,
      title: paper.title,
      abstract: paper.abstract,
      year: paper.year,
      venue: paper.venue,
      method_need: context?.methodNeed ?? null,
      population_need: context?.populationNeed ?? null,
      recency_need: context?.recencyNeed ?? "any",
      like_title: context?.likeTitle ?? null,
      like_abstract: context?.likeAbstract ?? null,
    },
    questions: {
      method: score(
        "Does the paper's method or approach match what the user needs?",
        [...METHOD_LEGENDS],
      ),
      population: score(
        "Does the paper study the right domain, setting, cohort, species, or system for the user's need?",
        [...POPULATION_LEGENDS],
      ),
      evidence: score(
        "How strong and usable is the evidence in this paper for the user's need?",
        [...EVIDENCE_LEGENDS],
      ),
      recency: score(
        "How well does the paper's timing fit the user's time need (see recency_need in state)?",
        [...RECENCY_LEGENDS],
      ),
      is_review: noul(
        "Is this paper primarily a survey, review, or systematic overview?",
        {
          true: "Survey, review, meta-analysis, or tutorial overview",
          false: "Primary research paper presenting a new method, system, or study",
        },
      ),
    },
  });

  const judged: CachedDims = {
    method: answers.method.score,
    population: answers.population.score,
    evidence: answers.evidence.score,
    recency: answers.recency.score,
    isReview: answers.is_review.noul,
  };
  scoreCache.set(key, judged);
  return judged;
}

function toRanked(
  paper: Paper,
  dims: CachedDims,
  preferReviews: boolean,
): RankedPaper {
  const relevance = topicRelevance(dims.method, dims.population);
  const composite = compositeScore(dims, preferReviews);
  return { ...paper, ...dims, relevance, composite, scored: true };
}

export async function rerankPapers(
  client: TypeSafeClient,
  question: string,
  papers: Paper[],
  intent: Intent,
  context?: ScoreContext,
): Promise<RankedPaper[]> {
  const preferReviews = intent.wantsReview >= 0.55;

  return mapPool(papers, CONCURRENCY, async (paper) => {
    const dims = await scorePaper(client, question, paper, context);
    return toRanked(paper, dims, preferReviews);
  });
}
