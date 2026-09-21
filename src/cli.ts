import "dotenv/config";

import {
  agentSearch,
  demoAgentPayload,
} from "./agent.js";
import { DEMO_RESULT } from "./demo-data.js";
import { loadLocalKey } from "./keys.js";
import { findPapers } from "./search.js";
import { filterAndSort, RELEVANCE_THRESHOLD } from "./score.js";
import type { RankedPaper } from "./types.js";

export function parseFindArgs(argv: string[]): {
  question: string;
  json: boolean;
  demo: boolean;
  scoreFirst: number;
} {
  let json = false;
  let demo = false;
  let scoreFirst = 12;
  const questionParts: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--demo") {
      demo = true;
      continue;
    }
    if (arg.startsWith("--score-first=")) {
      scoreFirst = Number.parseInt(arg.slice("--score-first=".length), 10);
      continue;
    }
    if (arg === "--score-first") {
      const next = argv[i + 1];
      if (next !== undefined) {
        scoreFirst = Number.parseInt(next, 10);
        i += 1;
      }
      continue;
    }
    questionParts.push(arg);
  }

  return {
    question: questionParts.join(" ").trim(),
    json,
    demo,
    scoreFirst: Number.isFinite(scoreFirst) ? scoreFirst : 12,
  };
}

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function printTable(papers: RankedPaper[]): void {
  if (papers.length === 0) {
    console.log("No papers above the relevance threshold.");
    return;
  }

  console.log(
    [
      "meth".padStart(4),
      "pop".padStart(4),
      "evi".padStart(4),
      "rec".padStart(4),
      "year".padStart(4),
      "title",
    ].join("  "),
  );
  console.log("-".repeat(100));

  for (const p of papers) {
    const year = p.year?.toString() ?? "????";
    console.log(
      [
        p.method.toFixed(1).padStart(4),
        p.population.toFixed(1).padStart(4),
        p.evidence.toFixed(1).padStart(4),
        p.recency.toFixed(1).padStart(4),
        year.padStart(4),
        truncate(p.title, 70),
      ].join("  "),
    );
    if (p.venue) console.log(`       venue: ${truncate(p.venue, 80)}`);
    if (p.url) console.log(`       ${p.url}`);
  }
}

async function main(): Promise<void> {
  const { question, json, demo, scoreFirst } = parseFindArgs(
    process.argv.slice(2),
  );

  if (!question && !demo) {
    console.error('Usage: npm run find -- "your research question"');
    console.error("       npm run find -- --json --score-first 0 \"question\"");
    console.error("       npm run find -- --demo");
    process.exit(1);
  }

  if (demo) {
    if (json) {
      console.log(JSON.stringify(demoAgentPayload()));
      return;
    }
    console.log("");
    console.log(`Results for: ${DEMO_RESULT.question}`);
    console.log("");
    printTable(DEMO_RESULT.papers);
    return;
  }

  await loadLocalKey();

  if (json) {
    const payload = await agentSearch(question, scoreFirst);
    console.log(JSON.stringify(payload));
    return;
  }

  const result = await findPapers(question, { scoreFirst });
  const scored = result.papers.filter((p) => p.scored);
  const papers =
    scored.length > 0
      ? filterAndSort(result.papers, RELEVANCE_THRESHOLD)
      : result.papers;
  console.log("");
  console.log(`Results for: ${question}`);
  if (result.pending > 0) {
    console.log(`${result.pending} waiting to be scored (page Jev on demand).`);
  }
  console.log("");
  printTable(papers);
}

const entry = process.argv[1]?.replace(/\\/g, "/") ?? "";
if (entry.endsWith("/src/cli.ts") || entry.endsWith("/cli.ts")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
