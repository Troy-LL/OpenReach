import { Chip } from "@heroui/react";
import type { PaperSource, RankedPaper } from "@shared/types";
import {
  EVIDENCE_LEGENDS,
  legendFor,
  METHOD_LEGENDS,
  POPULATION_LEGENDS,
  RECENCY_LEGENDS,
} from "@shared/score";
import { ScoreMeter } from "./ScoreMeter";
import { ScoreSkeleton } from "./Skeletons";

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
}: {
  paper: RankedPaper;
  figure: number;
}) {
  const heading = paper.url ? (
    <a
      className="text-foreground decoration-accent/40 underline-offset-3 hover:text-accent hover:underline"
      href={paper.url}
      rel="noreferrer"
      target="_blank"
    >
      {paper.title}
    </a>
  ) : (
    paper.title
  );

  return (
    <article className="plate group flex gap-4 p-5 transition-colors hover:border-[color-mix(in_oklch,var(--accent)_28%,var(--border))]">
      <span
        aria-hidden
        className="bg-surface-secondary text-accent mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums"
      >
        {figure}
      </span>
      <div className="min-w-0 flex-1">
        <p className="figure mb-2">
          {SOURCE_LABEL[paper.source]}
          {paper.year != null ? ` · ${paper.year}` : ""}
        </p>
        <h2 className="mt-0 mb-2 text-[1.15rem] leading-snug font-semibold text-balance">
          {heading}
        </h2>
        {paper.authors && paper.authors.length > 0 ? (
          <p className="text-muted mt-0 mb-2 text-sm text-pretty">
            {paper.authors.length > 4
              ? `${paper.authors.slice(0, 4).join(", ")}, et al.`
              : paper.authors.join(", ")}
          </p>
        ) : null}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {paper.venue ? (
            <Chip size="sm" variant="soft">
              <Chip.Label>{paper.venue}</Chip.Label>
            </Chip>
          ) : null}
          {paper.doi ? (
            <span className="font-mono text-muted text-xs">DOI {paper.doi}</span>
          ) : null}
        </div>
        <p className="text-muted mt-0 mb-4 max-w-[68ch] text-pretty leading-relaxed">
          {paper.abstract}
        </p>
        {paper.scored ? (
          <div aria-label="Jev scores" className="flex flex-col gap-3">
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
        ) : (
          <ScoreSkeleton />
        )}
      </div>
    </article>
  );
}
