# OpenReach Search Improvement Plan

Plan for better ranking and relevance in OpenReach using **Jev** (TypeSafe System One) plus local code scaffolding. **No embedding model** and no vector database — judgment stays on System One; retrieval, filters, weights, batching, dedupe, and citation stay in code.

## 1. Goal

Make “papers that actually answer the question” rise above keyword near-misses, without turning OpenReach into a black-box LLM ranker or an embedding search product.

- **Jev’s job:** structured labels and scored dimensions on a *small, pre-filtered* candidate set (relevance facets, method/population/evidence/recency, short justifications).
- **Code’s job:** retrieve widely, gate cheaply (BM25/keyword + metadata), dedupe, page/batch what Jev sees, combine dimension scores with controllable weights, and export citations deterministically.
- **Out of scope for this plan:** dense embeddings, cosine ranking, third-party embed APIs, or “one opaque relevance score” as the only signal.

Success looks like: denser first-page usefulness, debuggable why-this-paper ranks, cost that scales with “show more” / user depth — not with every raw hit from every index.

## 2. Code-gated RAG

Treat indexes as a wide recall layer; treat Jev as an expensive judge that only sees a gated subset.

**Pre-Jev pipeline (pure code):**

1. **Retrieve** across existing scholarly indexes (OpenAlex, Semantic Scholar, Crossref, OpenAIRE, DOAJ, arXiv, INSPIRE, Europe PMC, PubMed, bioRxiv/medRxiv, PLOS, ERIC) — same multi-source idea as today.
2. **Dedupe** early (DOI first; else title + year) so the judge never scores duplicates.
3. **Keyword / BM25-style pre-filter** on title + abstract against the user question (and optional query facets from a light split). Drop obvious non-matches before any System One call.
4. **Metadata filters** the user (or intent) already implies:
   - year / recency window
   - venue / source preferences
   - open-access signals when available
   - topic / field gates (reuse OpenAlex topics + existing field intent where useful)
5. **Cap** the gated pool that may ever be offered to Jev (e.g. top N by BM25, then pages of size ~8).

Jev never “searches the web.” Code decides *who is allowed into the room*; Jev only scores people already in the room. That is the RAG gate: retrieval + filters as context selection, System One as structured judgment over that context.

## 3. Jev structured scoring

Replace (or upgrade) today’s single-pass relevance / is-review / centrality pack with **explicit dimensions**, each a number plus a **one-line justification** returned in state the UI can show.

**Proposed dimensions (each scored via System One `score` or calibrated `noul`, with a short free-text justification field where the product allows — or a fixed rubric level whose legend *is* the justification):**

| Dimension | What it asks | Why it helps |
| --- | --- | --- |
| Method match | Does the paper’s method/approach match what the user needs? | Separates same-topic wrong-method papers |
| Population match | Right domain, setting, species, cohort, or system? | Cuts adjacent-field keyword hits |
| Evidence quality | Primary study vs thin claim; clarity of evidence for the need | Prefer usable evidence over buzzword overlap |
| Recency | Fit to the user’s time need (not “newer is always better”) | Tunable; not a hard year sort alone |

**Code combines dimensions** with controllable weights, e.g.:

`composite = w_m * method + w_p * population + w_e * evidence + w_r * recency (+ optional review bonus)`

Weights live in code (like today’s `WEIGHTS` in `score.ts`), not inside the model. Operators can retune ranking without re-prompting every rubric. UI can show per-dimension bars + the one-line justification so a bad rank is inspectable: *which* dimension failed, not “the model said so.”

**Relation to today:** keep intent classification and topic filtering; evolve `rerank.ts` from one relevance/centrality bundle into this multi-dimension form so Jev stays a labeled judge, not a mystery score.

## 4. On-demand batching for breadth

Separate **recall budget** from **Jev budget**.

- **Retrieve 200–500+ candidates with pure code** (indexes + filters + dedupe). Cost to Jev: zero.
- **Score only the first visible page** with Jev (aligned with current session / page-at-a-time scoring).
- **“Show more”** scores the *next* unscored batch on demand.
- Pending count and session id stay the source of truth for “how much left.”

Users who bounce after page one pay for page one. Power users who dig pay for depth. Never pre-score the entire 500 with System One on every query.

## 5. “Find more like this”

When a user likes a paper:

1. **Code extracts** seed terms from that paper’s title, abstract, venue, DOI-linked topics (OpenAlex concepts/topics, keywords if present) — deterministic string/topic extraction, not a second embedding space.
2. **Fresh retrieval** seeded from those terms (and related-works IDs when the index provides them), then the same code-gated filters + dedupe.
3. **Jev re-ranks** only the new gated page(s), with the liked paper’s method/population as soft context in the scoring state so “more like this” means *similar problem shape*, not just shared buzzwords.

No vector “nearest neighbor.” Seeded keyword/graph recall + structured Jev judgment.

## 6. APA citation export

Selection UX: user checks papers → **Export APA** (plain text) or **Export .bib**.

- Build citations from **existing metadata only**: authors, year, title, journal/venue, volume, issue, pages, DOI (and URL fallback).
- **Deterministic templates** — APA 7-style string rules and BibTeX `@article` / `@misc` shapes in code.
- **No LLM** for citation text. Missing fields → omit or use explicit placeholders the user can fix; never invent authors or page ranges.

Where indexes don’t return authors/volume/pages today, citation quality is a **metadata enrichment** follow-on (still code/API), not a Jev prompt.

## 7. Honest tradeoffs

| Risk | What it looks like | Mitigation via scaffolding |
| --- | --- | --- |
| **Jev cost per query** | System One calls scale with papers × dimensions | Code gates + on-demand batches; score only visible IDs; cache scores by (question, DOI/id) as today |
| **Latency** | Multi-dimension calls slower than one blob score | Page-sized concurrency pools; show unscored rows then fill; don’t block retrieve on Jev |
| **Non-determinism** | Same paper, slightly different centrality/noul | Rubrics with sharp true/false legends; cache; prefer discrete dimensions over one mushy score; show justifications |
| **Confident but wrong** | High method match on a wrong paper | Pre-filters remove garbage before Jev; UI shows dimensions; weights demote single-dimension spikes; human still decides what to cite |
| **Over-filtering** | BM25 drops a good paraphrase hit | Keep recall wide before the gate; tune BM25 threshold softly; specialty indexes still run by field |

Scaffolding makes failures *local and tunable*. A wrong weight or a bad year filter is a code fix; a wrong embedding space would not be.

## 8. File-level changes (descriptions only)

| Area | Change |
| --- | --- |
| **New `query-split` module** | Optional light split of the user question into facets (problem / method / population / constraints) via Jev `choice`/`noul` *or* deterministic heuristics — feeds filters and scoring state. No embeddings. |
| **`search.ts` / `session.ts`** | Staged retrieval: large code-only candidate set; session holds unscored backlog; score-first page; “show more” scores next ID batch. |
| **`rerank.ts`** | Multi-dimension System One questions (method, population, evidence, recency) + one-line justification per dimension; map into typed fields; leave composite to `score.ts` weights. |
| **`dedupe.ts`** | Tighten keys: DOI canonicalization first; else normalized title **+ year**; prefer richer abstract/metadata when merging. |
| **New citation module** | APA plain-text + BibTeX from paper metadata; export endpoint/CLI; no TypeSafe calls. |
| **`TYPESAFE_API_KEY` env separation** | Keep TypeSafe/Jev key loading (`keys.ts`, KeyGate, `.env.example`) cleanly scoped to System One. Do not overload this env for unrelated services; document any future non-Jev secrets under separate names. |

UI pieces (filters, dimension meters, export selection, “more like this”) follow the same session/API shapes; exact React file names can track the modules above.

## 9. Priority by impact

1. **Staged full-set scoring** — Large code recall + page/on-demand Jev. Biggest cost/latency win; unlocks breadth without burning keys.
2. **Structured scoring** — Method / population / evidence / recency + weights + justifications. Biggest relevance/debuggability win on the papers users already see.
3. **On-demand breadth + find-more-like-this** — “Show more” polish and seeded re-retrieve. Deepens exploration once (1)–(2) are solid.
4. **APA export** — High user value, low ranking risk; ship when metadata fields are good enough; deterministic only.

---

*OpenReach stays a retrieve → gate → judge → page system. Jev labels; code decides who gets labeled, how labels combine, and what gets exported.*
