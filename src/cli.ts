import "dotenv/config";

import { findPapers } from "./search.js";
import { filterAndSort, RELEVANCE_THRESHOLD } from "./score.js";
import type { RankedPaper } from "./types.js";

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
      "rel".padStart(5),
      "rev".padStart(5),
      "cen".padStart(4),
      "year".padStart(4),
      "title",
    ].join("  "),
  );
  console.log("-".repeat(100));

  for (const p of papers) {
    const year = p.year?.toString() ?? "????";
    console.log(
      [
        p.relevance.toFixed(2).padStart(5),
        p.isReview.toFixed(2).padStart(5),
        p.centrality.toFixed(1).padStart(4),
        year.padStart(4),
        truncate(p.title, 70),
      ].join("  "),
    );
    if (p.venue) console.log(`       venue: ${truncate(p.venue, 80)}`);
    if (p.url) console.log(`       ${p.url}`);
  }
}

async function main(): Promise<void> {
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) {
    console.error('Usage: npm run find -- "your research question"');
    process.exit(1);
  }

  const result = await findPapers(question, { scoreFirst: 12 });
  const papers = filterAndSort(result.papers, RELEVANCE_THRESHOLD);
  console.log("");
  console.log(`Results for: ${question}`);
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
