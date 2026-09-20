import { noul, score, TypeSafeClient } from "@typesafe-ai/sdk";
import { cacheKey, TtlLruCache } from "./cache.js";
import { compositeScore } from "./score.js";
import type { Intent, Paper, RankedPaper } from "./types.js";

const scoreCache = new TtlLruCache<
  Pick<RankedPaper, "relevance" | "isReview" | "centrality">
>(2000, 60 * 60 * 1000);

export function scoreCacheSize(): number {
  return scoreCache.size;
}

export function clearScoreCache(): void {
  scoreCache.clear();
}

function paperScoreKey(question: string, paper: Paper): string {
  return cacheKey([question, paper.doi ?? paper.id]);
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
): Promise<Pick<RankedPaper, "relevance" | "isReview" | "centrality">> {
  const key = paperScoreKey(question, paper);
  const cached = scoreCache.get(key);
  if (cached) return cached;

  const { answers } = await client.systemOne({
    state: {
      question,
      title: paper.title,
      abstract: paper.abstract,
      year: paper.year,
      venue: paper.venue,
    },
    questions: {
      relevance: noul(
        {
          task: "Does this paper address the user's research need?",
          important:
            "Wording may differ. Synonyms, field jargon, and paraphrases still count as yes when the paper studies the same problem, method, finding, or phenomenon the user asked about.",
          user_need: question,
        },
        {
          true: "Same problem, method, or finding — even if the paper uses different vocabulary than the user",
          false: "Only a nearby field, shared buzzwords, or a different problem that happens to mention similar terms",
        },
      ),
      is_review: noul(
        "Is this paper primarily a survey, review, or systematic overview?",
        {
          true: "Survey, review, meta-analysis, or tutorial overview",
          false: "Primary research paper presenting a new method, system, or study",
        },
      ),
      centrality: score(
        "How central is this paper to answering the user's need?",
        [
          "Tangential; only weakly connected after stretching the interpretation",
          "Background or adjacent; useful context but not the main answer",
          "Clearly on-topic; a reasonable paper to read for this need",
          "Strong match; among the better papers for this need",
          "Core match; directly targets what the user is looking for",
        ],
      ),
    },
  });

  const judged = {
    relevance: answers.relevance.noul,
    isReview: answers.is_review.noul,
    centrality: answers.centrality.score,
  };
  scoreCache.set(key, judged);
  return judged;
}

export async function rerankPapers(
  client: TypeSafeClient,
  question: string,
  papers: Paper[],
  intent: Intent,
): Promise<RankedPaper[]> {
  const preferReviews = intent.wantsReview >= 0.55;

  const scored = await mapPool(papers, CONCURRENCY, async (paper) => {
    const s = await scorePaper(client, question, paper);
    const composite = compositeScore(
      s.relevance,
      s.isReview,
      s.centrality,
      preferReviews,
    );
    return { ...paper, ...s, scored: true, composite };
  });

  return scored;
}
