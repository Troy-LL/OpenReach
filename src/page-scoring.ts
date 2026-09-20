import type { RankedPaper } from "./types.js";

/** Ids on this page that still need scoring (not already scored). */
export function unscoredIds(papers: RankedPaper[]): string[] {
  return papers.filter((p) => !p.scored).map((p) => p.id);
}
