import {
  Button,
  Checkbox,
  Fieldset,
  Input,
  Label,
  ListBox,
  Select,
  Slider,
  TextField,
} from "@heroui/react";
import {
  DEFAULT_FILTERS,
  PAPER_SOURCES,
  type PaperKind,
  type ResultFilters,
  type SortKey,
} from "@shared/filters";
import type { PaperSource } from "@shared/types";
import { useEffect, useRef } from "react";

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
  related: "Related / cited",
};

interface Props {
  filters: ResultFilters;
  onChange: (next: ResultFilters) => void;
  shown: number;
  total: number;
}

function asSort(key: string | number | null): SortKey {
  switch (key) {
    case "composite":
    case "relevance":
    case "method":
    case "population":
    case "evidence":
    case "recency":
    case "review":
    case "year_desc":
    case "year_asc":
      return key;
    default:
      return "composite";
  }
}

function asKind(key: string | number | null): PaperKind {
  switch (key) {
    case "all":
    case "reviews":
    case "primary":
      return key;
    default:
      return "all";
  }
}

export function Filters({ filters, onChange, shown, total }: Props) {
  const disclosure = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const node = disclosure.current;
    if (!node) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      node.open = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const patch = (partial: Partial<ResultFilters>) =>
    onChange({ ...filters, ...partial });

  const selected = filters.sources ?? PAPER_SOURCES;

  const toggleSource = (source: PaperSource) => {
    const next = selected.includes(source)
      ? selected.filter((s) => s !== source)
      : [...selected, source];
    patch({ sources: next.length === PAPER_SOURCES.length ? null : next });
  };

  return (
    <form
      aria-label="Result filters"
      className="md:sticky md:top-[4.25rem]"
      onSubmit={(e) => e.preventDefault()}
    >
      <details ref={disclosure} className="filters-disclosure plate">
        <summary className="filters-summary">
          <span>Filters · {shown}/{total}</span>
          <span aria-hidden className="filters-chevron" />
        </summary>
        <div className="filters-body flex flex-col gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:gap-4 md:p-4">
      <div className="hidden items-baseline justify-between gap-2 md:flex">
        <div>
          <p className="figure mb-1">Refine</p>
          <h2 className="m-0 text-lg font-semibold">Filters</h2>
        </div>
        <p className="text-muted m-0 font-mono text-sm tabular-nums">
          {shown}/{total}
        </p>
      </div>

      <Select
        className="w-full"
        fullWidth
        selectedKey={filters.sort}
        onSelectionChange={(key) => patch({ sort: asSort(key) })}
      >
        <Label>Sort</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="composite" textValue="Best match">
              Best match
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="relevance" textValue="Relevance">
              Relevance
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="method" textValue="Method match">
              Method match
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="population" textValue="Population match">
              Population match
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="evidence" textValue="Evidence">
              Evidence
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="recency" textValue="Recency fit">
              Recency fit
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="review" textValue="Most review-like">
              Most review-like
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="year_desc" textValue="Newest">
              Newest
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="year_asc" textValue="Oldest">
              Oldest
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>

      <Select
        className="w-full"
        fullWidth
        selectedKey={filters.kind}
        onSelectionChange={(key) => patch({ kind: asKind(key) })}
      >
        <Label>Paper type</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="all" textValue="All types">
              All types
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="reviews" textValue="Reviews / surveys">
              Reviews / surveys
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="primary" textValue="Primary research">
              Primary research
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>

      <Slider
        maxValue={1}
        minValue={0}
        step={0.05}
        value={filters.minRelevance}
        onChange={(value) =>
          patch({ minRelevance: Array.isArray(value) ? value[0] : value })
        }
      >
        <Label>Min relevance</Label>
        <Slider.Output className="font-mono text-xs tabular-nums">
          {Math.round(filters.minRelevance * 100)}%
        </Slider.Output>
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>

      <Slider
        maxValue={4}
        minValue={0}
        step={1}
        value={filters.minEvidence}
        onChange={(value) =>
          patch({ minEvidence: Array.isArray(value) ? value[0] : value })
        }
      >
        <Label>Min evidence</Label>
        <Slider.Output className="font-mono text-xs tabular-nums">
          {filters.minEvidence}
        </Slider.Output>
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>

      <Fieldset>
        <Fieldset.Legend>Year</Fieldset.Legend>
        <Fieldset.Group className="grid min-w-0 grid-cols-2 gap-2">
          <TextField
            className="min-w-0"
            value={filters.yearFrom?.toString() ?? ""}
            onChange={(value) =>
              patch({ yearFrom: value ? Number(value) : null })
            }
          >
            <Label>From</Label>
            <Input inputMode="numeric" placeholder="2015" type="number" />
          </TextField>
          <TextField
            className="min-w-0"
            value={filters.yearTo?.toString() ?? ""}
            onChange={(value) =>
              patch({ yearTo: value ? Number(value) : null })
            }
          >
            <Label>To</Label>
            <Input inputMode="numeric" placeholder="2024" type="number" />
          </TextField>
        </Fieldset.Group>
        <Checkbox
          isSelected={filters.includeUnknownYear}
          onChange={(isSelected) => patch({ includeUnknownYear: isSelected })}
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Include papers with no year
          </Checkbox.Content>
        </Checkbox>
      </Fieldset>

      <Fieldset>
        <Fieldset.Legend>Sources</Fieldset.Legend>
        <Fieldset.Group className="flex flex-col gap-2">
          {PAPER_SOURCES.map((source) => (
            <Checkbox
              key={source}
              isSelected={selected.includes(source)}
              onChange={() => toggleSource(source)}
            >
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                {SOURCE_LABEL[source]}
              </Checkbox.Content>
            </Checkbox>
          ))}
        </Fieldset.Group>
      </Fieldset>

      <TextField
        value={filters.venueQuery}
        onChange={(venueQuery) => patch({ venueQuery })}
      >
        <Label>Venue contains</Label>
        <Input placeholder="CVPR, Nature…" />
      </TextField>

      <TextField
        value={filters.textQuery}
        onChange={(textQuery) => patch({ textQuery })}
      >
        <Label>Title or abstract contains</Label>
        <Input placeholder="skip connection" />
      </TextField>

      <Checkbox
        isSelected={filters.requireDoi}
        onChange={(isSelected) => patch({ requireDoi: isSelected })}
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Has DOI
        </Checkbox.Content>
      </Checkbox>
      <Checkbox
        isSelected={filters.requireUrl}
        onChange={(isSelected) => patch({ requireUrl: isSelected })}
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Has a link
        </Checkbox.Content>
      </Checkbox>

      <Button
        className="pressable min-h-11"
        size="sm"
        type="button"
        variant="secondary"
        onPress={() => onChange(DEFAULT_FILTERS)}
      >
        Reset filters
      </Button>
        </div>
      </details>
    </form>
  );
}
