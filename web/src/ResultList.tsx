import { useEffect, type ReactNode } from "react";
import { unscoredIds } from "@shared/page-scoring";
import type { RankedPaper } from "@shared/types";

interface Props {
  items: RankedPaper[];
  startIndex: number;
  renderItem: (paper: RankedPaper, index: number) => ReactNode;
  onVisibleIds?: (ids: string[]) => void;
}

/** Renders one page of results with document scroll (no nested scroller). */
export function ResultList({
  items,
  startIndex,
  renderItem,
  onVisibleIds,
}: Props) {
  useEffect(() => {
    onVisibleIds?.(unscoredIds(items));
  }, [items, onVisibleIds]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [startIndex]);

  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0 md:gap-3" start={startIndex + 1}>
      {items.map((paper, index) => (
        <li key={paper.id}>{renderItem(paper, startIndex + index)}</li>
      ))}
    </ol>
  );
}
