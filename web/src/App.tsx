import { Alert, Button, EmptyState, SearchField } from "@heroui/react";
import { applyFilters, DEFAULT_FILTERS, type ResultFilters } from "@shared/filters";
import { DEFAULT_PAGE_SIZE, paginate } from "@shared/pagination";
import type { RankedPaper, SearchResult } from "@shared/types";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  clearApiKey,
  clearServerCache,
  getHealth,
  loadDemo,
  moreLikePaper,
  scoreVisible,
  searchPapers,
} from "./api";
import { hasClientKey } from "./client-key";
import { ExportBar } from "./ExportBar";
import { Filters } from "./Filters";
import { KeyLockedChip } from "./GatedHint";
import { KeyGate } from "./KeyGate";
import { PaginationBar } from "./PaginationBar";
import { PaperCard } from "./PaperCard";
import { ResultList } from "./ResultList";
import { Shell } from "./Shell";
import { BootSkeleton, FilterSkeleton, SearchSkeleton } from "./Skeletons";
import { SuggestField } from "./SuggestField";

function mergeScored(current: RankedPaper[], incoming: RankedPaper[]): RankedPaper[] {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((p) => [p.id, p]));
  for (const paper of incoming) {
    byId.set(paper.id, paper);
  }
  return [...byId.values()];
}

export function App() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [filters, setFilters] = useState<ResultFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const inFlight = useRef(new Set<string>());
  const resultRef = useRef(result);
  resultRef.current = result;

  const shown = useMemo(
    () => (result ? applyFilters(result.papers, filters) : []),
    [result, filters],
  );

  const slice = useMemo(
    () => paginate(shown, page, DEFAULT_PAGE_SIZE),
    [shown, page],
  );

  useEffect(() => {
    setPage(1);
  }, [filters, result?.sessionId, result?.question]);

  useEffect(() => {
    if (page !== slice.page) setPage(slice.page);
  }, [page, slice.page]);

  const scoredCount = result?.papers.filter((p) => p.scored).length ?? 0;
  const landing = result === null && !busy;
  const sampleMode = Boolean(result && !result.sessionId && !busy);

  useEffect(() => {
    if (hasClientKey()) {
      setHasKey(true);
      return;
    }
    void getHealth()
      .then((health) => setHasKey(health.hasKey))
      .catch(() => setHasKey(false));
  }, []);

  async function run(action: () => Promise<SearchResult>) {
    setBusy(true);
    setError(null);
    inFlight.current.clear();
    setSelectedIds(new Set());
    try {
      const next = await action();
      setResult(next);
      setDraft(next.question);
      setFilters(DEFAULT_FILTERS);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy || !hasKey) return;
    void run(() => searchPapers(question));
  }

  function onSuggestPick(text: string) {
    const question = text.trim();
    if (!question || busy || !hasKey) return;
    void run(() => searchPapers(question));
  }

  const resetToLanding = useCallback(() => {
    setResult(null);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    setSelectedIds(new Set());
    inFlight.current.clear();
    void clearServerCache();
  }, []);

  const toggleSelected = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const selectedPapers = useMemo(() => {
    if (!result) return [];
    return result.papers.filter((p) => selectedIds.has(p.id));
  }, [result, selectedIds]);

  function onMoreLike(paper: RankedPaper) {
    if (busy || !hasKey) return;
    void run(() => moreLikePaper(paper));
  }

  useEffect(() => {
    const onHide = () => {
      void clearServerCache();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const onVisibleIds = useCallback((ids: string[]) => {
    const current = resultRef.current;
    if (!current?.sessionId || ids.length === 0) return;

    const needed = ids.filter((id) => {
      if (inFlight.current.has(id)) return false;
      const paper = current.papers.find((p) => p.id === id);
      return paper && !paper.scored;
    });
    if (needed.length === 0) return;

    for (const id of needed) inFlight.current.add(id);
    const sessionId = current.sessionId;

    void scoreVisible(sessionId, needed)
      .then((update) => {
        setResult((prev) => {
          if (!prev || prev.sessionId !== sessionId) return prev;
          return {
            ...prev,
            papers: mergeScored(prev.papers, update.papers),
            pending: update.pending,
          };
        });
      })
      .catch((err) => {
        if (err instanceof Error && /expired/i.test(err.message)) {
          setResult((prev) => (prev ? { ...prev, sessionId: null, pending: 0 } : prev));
          setError("This search expired. Run it again to keep scoring.");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not score papers.");
      })
      .finally(() => {
        for (const id of needed) inFlight.current.delete(id);
      });
  }, []);

  async function removeLocalKey() {
    const next = await clearApiKey();
    setHasKey(next.hasKey);
    if (!next.hasKey) {
      resetToLanding();
    }
  }

  const addKeyLink = (
    <Button className="px-0" variant="ghost" onPress={resetToLanding}>
      Add a TypeSafe key
    </Button>
  );

  const searchForm = (compact = false) => (
    <form
      className={
        compact
          ? "flex flex-row items-stretch gap-2"
          : "flex flex-col gap-3 sm:flex-row sm:items-stretch"
      }
      onSubmit={onSubmit}
    >
      <SuggestField
        disabled={busy || !hasKey}
        value={draft}
        onChange={setDraft}
        onPick={onSuggestPick}
      >
        <SearchField
          aria-label="Research question"
          autoFocus={landing}
          className="min-w-0 w-full flex-1"
          fullWidth
          isDisabled={busy}
          name="question"
          value={draft}
          onChange={setDraft}
        >
          <SearchField.Group className="min-w-0 w-full">
            <SearchField.SearchIcon />
            <SearchField.Input
              className="min-w-0 flex-1 overflow-hidden text-ellipsis"
              placeholder="Ask anything about the literature…"
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </SuggestField>
      <Button
        className={
          compact
            ? "pressable min-h-11 shrink-0"
            : "pressable min-h-11 w-full shrink-0 sm:w-auto"
        }
        isDisabled={!draft.trim() || !hasKey}
        isPending={busy}
        size={compact ? "sm" : undefined}
        type="submit"
      >
        {busy ? "Searching…" : "Search"}
      </Button>
    </form>
  );

  if (hasKey === null) {
    return <BootSkeleton />;
  }

  if (!hasKey && landing) {
    return (
      <>
        <KeyGate
          sampleBusy={busy}
          onBrowseSample={() => void run(loadDemo)}
          onSaved={() => setHasKey(true)}
        />
        {error ? (
          <div className="mx-auto max-w-[40rem] px-5">
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Could not load sample results</Alert.Title>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          </div>
        ) : null}
      </>
    );
  }

  if (landing) {
    return (
      <Shell
        centered
        trailing={
          <Button className="pressable" size="sm" variant="ghost" onPress={() => void removeLocalKey()}>
            Remove key
          </Button>
        }
      >
        <div className="enter text-center">
          <h1 className="mt-0 mb-3 text-[clamp(2.4rem,6vw,3.4rem)] leading-[1.05] font-semibold tracking-tight">
            <span className="text-accent">OpenReach</span>
          </h1>
          <p className="text-muted mx-auto mb-8 max-w-md text-pretty">
            Ask a research question. Indexes return candidates first — Jev scores
            each paper when it lands on the current page.
          </p>
        </div>
        <div className="enter enter-1 search-shell p-3 sm:p-4">{searchForm()}</div>
        {error ? (
          <Alert className="mt-5" role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Search did not finish</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
        <div className="enter enter-2 mt-8 flex justify-center">
          <Button
            className="pressable"
            isDisabled={busy}
            variant="secondary"
            onPress={() => void run(loadDemo)}
          >
            Load sample results
          </Button>
        </div>
      </Shell>
    );
  }

  const heading = result?.question || draft || "Searching";

  return (
    <Shell
      plate={busy ? "Retrieving" : sampleMode ? "Sample" : "Results"}
      trailing={
        <Button className="pressable" size="sm" variant="ghost" onPress={resetToLanding}>
          New search
        </Button>
      }
    >
      <div className="mb-4">
        <h1 className="mt-0 mb-3 text-lg md:text-[clamp(1.35rem,2.5vw,1.75rem)] leading-snug font-semibold text-balance">
          {heading}
        </h1>
        <div className="search-shell p-2 sm:p-4">{searchForm(true)}</div>
        {error ? (
          <Alert className="mt-4" role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Search did not finish</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
        {sampleMode ? (
          <Alert className="mt-4" status="accent">
            <Alert.Content>
              <Alert.Title>Sample results</Alert.Title>
              <Alert.Description>
                Fixed examples for trying filters.
                {!hasKey ? <> {addKeyLink} to search live.</> : null}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : !hasKey ? (
          <p className="text-muted mt-3 mb-0 text-sm">
            {addKeyLink} to run a live search.
          </p>
        ) : null}
      </div>

      <div className="grid items-start gap-7 md:grid-cols-[16rem_1fr]">
        <aside>
          {busy || !result ? (
            <FilterSkeleton />
          ) : (
            <Filters
              filters={filters}
              shown={shown.length}
              total={result.papers.length}
              onChange={setFilters}
            />
          )}
        </aside>
        <main>
          {busy ? (
            <>
              <p className="figure mb-4" role="status">
                Retrieving candidates…
              </p>
              <SearchSkeleton />
            </>
          ) : result && shown.length === 0 ? (
            <EmptyState className="plate p-8">
              <p className="figure mb-2">No match</p>
              <h2 className="m-0 text-xl font-semibold">
                No papers match these filters
              </h2>
              <p className="text-muted mb-4 max-w-prose text-pretty">
                Reset the filters, or loosen the year and score sliders.
              </p>
              <Button className="pressable" variant="secondary" onPress={() => setFilters(DEFAULT_FILTERS)}>
                Reset filters
              </Button>
            </EmptyState>
          ) : result ? (
            <>
              <ExportBar
                busy={busy}
                judged={scoredCount}
                page={slice.page}
                papers={selectedPapers}
                pending={result.pending}
                total={result.papers.length}
                totalPages={slice.totalPages}
                onError={setError}
              />
              <ResultList
                items={slice.items}
                startIndex={slice.startIndex}
                onVisibleIds={onVisibleIds}
                renderItem={(paper, index) => (
                  <div>
                    <PaperCard
                      figure={index + 1}
                      paper={paper}
                      selected={selectedIds.has(paper.id)}
                      selectionDisabled={busy}
                      onSelectedChange={(checked) => toggleSelected(paper.id, checked)}
                    />
                    <div className="mt-1 flex items-center justify-end">
                      {hasKey ? (
                        <Button
                          aria-label={`Find papers more like ${paper.title}`}
                          className="pressable"
                          isDisabled={busy}
                          size="sm"
                          variant="ghost"
                          onPress={() => onMoreLike(paper)}
                        >
                          More like this
                        </Button>
                      ) : (
                        <KeyLockedChip hint="Find related papers after you save a TypeSafe key." />
                      )}
                    </div>
                  </div>
                )}
              />
              <PaginationBar
                page={slice.page}
                pageSize={slice.pageSize}
                totalItems={slice.totalItems}
                totalPages={slice.totalPages}
                onPageChange={setPage}
              />
            </>
          ) : (
            <SearchSkeleton />
          )}
        </main>
      </div>
    </Shell>
  );
}
