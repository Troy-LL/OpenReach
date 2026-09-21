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
      className="mb-3 flex flex-wrap items-center gap-2"
      role="toolbar"
    >
      <span className="font-mono text-sm tabular-nums">
        {judged}/{total}
        {pending > 0 ? (
          <span className="max-sm:hidden">{` · ${pending} waiting`}</span>
        ) : null}
        {` · p${page}/${totalPages}`}
      </span>
      {papers.length > 0 ? (
        <span className="text-muted text-sm tabular-nums">{papers.length} selected</span>
      ) : null}
      <Tooltip isDisabled={papers.length > 0}>
        <Tooltip.Trigger>
          <span className="inline-flex">
            <Button
              aria-label="Export selected papers as APA"
              className="pressable"
              isDisabled={disabled}
              size="sm"
              variant="secondary"
              onPress={() => void onExport("apa")}
            >
              Export APA
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
              className="pressable"
              isDisabled={disabled}
              size="sm"
              variant="secondary"
              onPress={() => void onExport("bibtex")}
            >
              Export .bib
            </Button>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Content>Select papers to export</Tooltip.Content>
      </Tooltip>
    </div>
  );
}
