import { Button, Tooltip } from "@heroui/react";
import type { RankedPaper } from "@shared/types";
import { exportCitations } from "./api";

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface Props {
  papers: RankedPaper[];
  busy?: boolean;
  judged: number;
  total: number;
  page: number;
  totalPages: number;
  pending?: number;
  onError: (message: string) => void;
}

export function ExportBar({
  papers,
  busy,
  judged,
  total,
  page,
  totalPages,
  pending = 0,
  onError,
}: Props) {
  const disabled = busy || papers.length === 0;

  async function onExport(format: "apa" | "bibtex") {
    try {
      const { text } = await exportCitations(format, papers);
      if (format === "apa") {
        downloadText("openreach.apa.txt", text, "text/plain;charset=utf-8");
      } else {
        downloadText("openreach.bib", text, "application/x-bibtex;charset=utf-8");
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Export failed.");
    }
  }

  return (
    <div
      aria-label="Export selected papers"
      className="mb-1 flex min-w-0 flex-wrap items-center gap-2"
      role="toolbar"
    >
      <span className="font-mono min-w-0 text-sm tabular-nums">
        {judged}/{total}
        {pending > 0 ? ` · ${pending} waiting` : null}
        {` · p${page}/${totalPages}`}
      </span>
      {papers.length > 0 ? (
        <span className="text-muted min-w-0 text-sm tabular-nums">{papers.length} selected</span>
      ) : (
        <span className="text-muted min-w-0 text-sm">Select to export</span>
      )}
      <span className="inline-flex min-w-0 flex-wrap gap-2">
      <Tooltip isDisabled={papers.length > 0}>
        <Tooltip.Trigger>
          <span className="inline-flex">
            <Button
              aria-label="Export selected papers as APA"
              className="pressable min-h-11"
              isDisabled={disabled}
              size="sm"
              variant="secondary"
              onPress={() => void onExport("apa")}
            >
              <span className="sm:hidden">APA</span>
              <span className="max-sm:hidden">Export APA</span>
            </Button>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Content>Select papers to export</Tooltip.Content>
      </Tooltip>
      <Tooltip isDisabled={papers.length > 0}>
        <Tooltip.Trigger>
          <span className="inline-flex">
            <Button
              aria-label="Export selected papers as BibTeX"
              className="pressable min-h-11"
              isDisabled={disabled}
              size="sm"
              variant="secondary"
              onPress={() => void onExport("bibtex")}
            >
              <span className="sm:hidden">.bib</span>
              <span className="max-sm:hidden">Export .bib</span>
            </Button>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Content>Select papers to export</Tooltip.Content>
      </Tooltip>
      </span>
    </div>
  );
}
