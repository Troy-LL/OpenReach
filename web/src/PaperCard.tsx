import { Chip } from "@heroui/react";
import { safeHttpUrl } from "@shared/safe-url";
import type { PaperSource, RankedPaper } from "@shared/types";
import {
  EVIDENCE_LEGENDS,
  legendFor,
  METHOD_LEGENDS,
  POPULATION_LEGENDS,
  RECENCY_LEGENDS,
} from "@shared/score";
import { useState } from "react";
import { ScoreMeter } from "./ScoreMeter";
import { ScoreSkeleton } from "./Skeletons";

const ABSTRACT_CLAMP_CHARS = 160;

const SOURCE_LABEL: Record<PaperSource, string> = {
  openalex: "OpenAlex",
  semantic_scholar: "Semantic Scholar",
  crossref: "Crossref",
  openaire: "OpenAIRE",
  doaj: "DOAJ",
  arxiv: "arXiv",
  inspire: "INSPIRE-HEP",
  europe_pmc: "Europe PMC",
  pubmed: "PubMed",
  biorxiv: "bioRxiv",
  medrxiv: "medRxiv",
  plos: "PLOS",
  eric: "ERIC",
  related: "Related",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function PaperCard({
  paper,
  figure,
  selected,
  selectionDisabled,
  onSelectedChange,
}: {
  paper: RankedPaper;
  figure: number;
  selected: boolean;
  selectionDisabled?: boolean;
  onSelectedChange: (checked: boolean) => void;
}) {
  const [abstractOpen, setAbstractOpen] = useState(false);
  const canExpand = paper.abstract.trim().length > ABSTRACT_CLAMP_CHARS;

  const href = safeHttpUrl(paper.url);
  const heading = href ? (
    <a
      className="text-foreground decoration-accent/40 underline-offset-3 hover:text-accent hover:underline"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {paper.title}
    </a>
  ) : (
    paper.title
  );

  return (
    <article
      className={`plate group relative flex min-w-0 gap-2 overflow-x-clip p-3 transition-colors hover:border-[color-mix(in_oklch,var(--accent)_28%,var(--border))] md:gap-4 md:p-5 ${
        selected
          ? "border-[color-mix(in_oklch,var(--accent)_45%,var(--border))]"
          : ""
      }`}
    >
      <label className="paper-select">
        <input
          aria-label={`Select ${paper.title}`}
          checked={selected}
          disabled={selectionDisabled}
          type="checkbox"
          onChange={(event) => onSelectedChange(event.currentTarget.checked)}
        />
        <span aria-hidden className="paper-select-box" />
      </label>
      <span
        aria-hidden
        className="bg-surface-secondary text-accent mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums md:mt-1.5 md:h-8 md:w-8"
      >
        {figure}
      </span>
      <div className="min-w-0 flex-1">
        <p className="figure mb-2">
          {SOURCE_LABEL[paper.source]}
          {paper.year != null ? ` · ${paper.year}` : ""}
          {!href ? " · No link" : ""}
        </p>
        <h2 className="font-serif mt-0 mb-1 max-md:line-clamp-2 text-base leading-snug font-semibold md:mb-2 md:text-[1.15rem] md:text-balance">
          {heading}
        </h2>
        {paper.authors && paper.authors.length > 0 ? (
          <p className="text-muted mt-0 mb-1 truncate text-sm md:mb-2">
            {paper.authors.length > 4
              ? `${paper.authors.slice(0, 4).join(", ")}, et al.`
              : paper.authors.join(", ")}
          </p>
        ) : null}
        <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2 max-sm:hidden md:mb-3">
          {paper.venue ? (
            <Chip className="max-w-full" size="sm" variant="soft">
              <Chip.Label className="truncate">{paper.venue}</Chip.Label>
            </Chip>
          ) : null}
          {paper.doi ? (
            <span className="font-mono text-muted max-w-full truncate text-xs">
              DOI {paper.doi}
            </span>
          ) : null}
        </div>
        <p
          className={
            abstractOpen
              ? "text-muted mt-0 mb-1 max-w-[68ch] text-pretty leading-relaxed md:mb-4"
              : "text-muted mt-0 mb-1 max-w-[68ch] text-pretty leading-relaxed max-md:line-clamp-2 md:mb-4"
          }
        >
          {paper.abstract}
        </p>
        {canExpand ? (
          <button
            className="show-more text-accent mb-2 inline-flex cursor-pointer border-0 bg-transparent p-0 text-sm font-medium md:hidden"
            type="button"
            onClick={() => setAbstractOpen((open) => !open)}
          >
            {abstractOpen ? "Show less" : "Show more"}
          </button>
        ) : null}
        {paper.scored ? (
          <details className="score-block">
            <summary
              aria-label="Jev scores"
              className="flex min-w-0 cursor-pointer flex-wrap items-center gap-1.5"
            >
              <Chip className="score-chip" size="sm" variant="soft">
                <Chip.Label>Rel {pct(paper.relevance)}</Chip.Label>
              </Chip>
              <Chip className="score-chip" size="sm" variant="soft">
                <Chip.Label>Method {paper.method.toFixed(0)}</Chip.Label>
              </Chip>
              <Chip className="score-chip" size="sm" variant="soft">
                <Chip.Label>Pop {paper.population.toFixed(0)}</Chip.Label>
              </Chip>
              <Chip className="score-chip" size="sm" variant="soft">
                <Chip.Label>Evid {paper.evidence.toFixed(0)}</Chip.Label>
              </Chip>
              <Chip className="score-chip" size="sm" variant="soft">
                <Chip.Label>Rec {paper.recency.toFixed(0)}</Chip.Label>
              </Chip>
              <Chip className="score-chip" size="sm" variant="soft">
                <Chip.Label>Review {pct(paper.isReview)}</Chip.Label>
              </Chip>
              <span className="text-muted text-xs">Details</span>
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <ScoreMeter
                display={pct(paper.relevance)}
                label="Relevance"
                value={paper.relevance}
              />
              <ScoreMeter
                display={paper.method.toFixed(0)}
                justification={legendFor(METHOD_LEGENDS, paper.method)}
                label="Method"
                max={4}
                value={paper.method}
              />
              <ScoreMeter
                display={paper.population.toFixed(0)}
                justification={legendFor(POPULATION_LEGENDS, paper.population)}
                label="Population"
                max={4}
                value={paper.population}
              />
              <ScoreMeter
                display={paper.evidence.toFixed(0)}
                justification={legendFor(EVIDENCE_LEGENDS, paper.evidence)}
                label="Evidence"
                max={4}
                value={paper.evidence}
              />
              <ScoreMeter
                display={paper.recency.toFixed(0)}
                justification={legendFor(RECENCY_LEGENDS, paper.recency)}
                label="Recency"
                max={4}
                value={paper.recency}
              />
              <ScoreMeter
                display={pct(paper.isReview)}
                label="Review-like"
                value={paper.isReview}
              />
            </div>
          </details>
        ) : (
          <ScoreSkeleton />
        )}
      </div>
    </article>
  );
}
