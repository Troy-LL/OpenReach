import "dotenv/config";

import { describe, expect, it } from "vitest";
import { createClient } from "../src/intent.js";
import { scorePaper } from "../src/rerank.js";
import { topicRelevance } from "../src/score.js";
import type { Paper } from "../src/types.js";

const hasKey = Boolean(process.env.TYPESAFE_API_KEY?.trim());

function paper(title: string, abstract: string): Paper {
  return {
    id: title,
    title,
    abstract,
    year: 2020,
    venue: null,
    doi: null,
    url: null,
    source: "openalex",
  };
}

/**
 * Fixture cases lock the wording-mismatch criteria:
 * - synonym: same idea, different words → high relevance
 * - near-miss: nearby field, wrong problem → low relevance
 * - exact: shared keywords and same topic → high relevance
 */
const fixtures = [
  {
    name: "synonym match (wording differs)",
    question:
      "How do people keep phone batteries from dying too fast when apps run in the background?",
    paper: paper(
      "Energy-Aware Scheduling of Background Workloads on Mobile Devices",
      "We study duty-cycling and deferred execution of non-interactive tasks to reduce joule draw on smartphones. Our profiler measures milliamp-hours across common OS power states.",
    ),
    expect: "high" as const,
  },
  {
    name: "near-miss (nearby field, wrong problem)",
    question:
      "How do people keep phone batteries from dying too fast when apps run in the background?",
    paper: paper(
      "Lithium-Ion Cathode Materials for Electric Vehicles",
      "We synthesize nickel-rich layered oxides and report cycle life under high C-rate charging for automotive cells.",
    ),
    expect: "low" as const,
  },
  {
    name: "exact keyword match",
    question: "background app battery drain on smartphones",
    paper: paper(
      "Measuring Background App Battery Drain on Smartphones",
      "This paper measures background app battery drain on smartphones and proposes OS policies to limit wakeups.",
    ),
    expect: "high" as const,
  },
  {
    name: "paraphrase of ML classic",
    question:
      "What paper introduced the idea of skipping connections so very deep image networks can train well?",
    paper: paper(
      "Deep Residual Learning for Image Recognition",
      "We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously. Layers learn residual functions with reference to layer inputs.",
    ),
    expect: "high" as const,
  },
] as const;

describe.skipIf(!hasKey)("Jev relevance fixtures", () => {
  for (const fix of fixtures) {
    it(
      fix.name,
      async () => {
        const client = createClient();
        const scored = await scorePaper(client, fix.question, fix.paper);
        const relevance = topicRelevance(scored.method, scored.population);
        if (fix.expect === "high") {
          expect(relevance).toBeGreaterThanOrEqual(0.55);
        } else {
          expect(relevance).toBeLessThan(0.45);
        }
      },
      60_000,
    );
  }
});

describe.skipIf(hasKey)("Jev relevance fixtures (skipped)", () => {
  it("skips when TYPESAFE_API_KEY is unset", () => {
    expect(hasKey).toBe(false);
  });
});
