# OpenReach

OpenReach is a paper searcher. You ask a research question in plain language, OpenReach retrieves candidate papers across a dozen scholarly indexes, and then Jev (TypeSafe System One) scores each candidate's title and abstract against your question. Jev is a decision model rather than a generator: it returns scores and labels, and the ranking, filtering, and citation formatting all stay in code. There are no embeddings and no vector database. Results are paginated at eight per page, and only the page you are looking at gets scored.

## Run it locally

```bash
npm install
npm run dev
```

UI: http://127.0.0.1:5173  
API: http://127.0.0.1:3000

Both processes bind IPv4 `127.0.0.1` so that Vite's `/api` proxy can reach the API. The API reloads on source changes through Node's own watcher: the `dev:api` script runs `node --import tsx --watch-path=src src/server.ts`.

The first screen asks for a TypeSafe / Jev key and saves it to `data/typesafe.key` on this machine. That file is gitignored and is never copied into the Docker image. If you set `TYPESAFE_API_KEY` in your environment, it takes precedence over the saved file. Never commit a key.

Two things work without a live Jev call: **Browse sample results**, which exercises the filters against fixed sample papers, and the search box itself, which shows OpenAlex autocomplete suggestions for papers, topics, and concepts as you type. Arrow keys move through suggestions, Enter selects, and Escape closes the list.

## Command line

```bash
npm test
npm run typecheck
npm run find -- "your question"
npm run find -- --json --score-first 0 "your question"
npm run find -- --demo
```

`--json` prints a machine-readable payload, `--score-first N` sets how many papers Jev scores immediately (the CLI scores 12 by default, and `0` skips scoring so you see the gated candidates as retrieved), and `--demo` runs against the sample papers without a key.

## Indexes

| Source | Role |
| --- | --- |
| OpenAlex | Broad scholarly graph + related works |
| Semantic Scholar | Broad semantic search |
| Crossref | Publisher DOI / metadata layer |
| OpenAIRE | EU / open research aggregator |
| DOAJ | Open-access journal articles |
| arXiv | CS / physics / math preprints |
| INSPIRE-HEP | High-energy physics |
| Europe PMC | Life sciences literature |
| PubMed | Biomedical gold-standard index |
| bioRxiv / medRxiv | Life-science and clinical preprints |
| PLOS | Open-access life / computational biology journals |
| ERIC | Education / social-science literature |

When OpenReach can tell which field a question belongs to, it runs the specialty indexes for that field. When no field is clear, every index runs so that coverage stays wide.

## HTTP for agents

Under either `npm run dev` or `npm start`, the API listens on port 3000, which you can override with `PORT`. An agent that knows nothing else about OpenReach can start at `GET /api`, which returns a JSON index of the routes below: `name`, `version`, a `docs` link to <https://github.com/Troy-LL/OpenReach#readme>, and an `endpoints[]` array where each entry carries `method`, `path`, and `purpose`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health, key presence, cache sizes |
| GET | `/api/demo` | Sample results without live Jev |
| POST | `/api/search` | JSON body `{ "question" }` — retrieve + gate |
| POST | `/api/score` | JSON `{ "sessionId", "ids" }` — score visible rows |
| POST | `/api/export` | JSON `{ "format": "apa" \| "bibtex", "papers" }` |
| POST | `/api/more-like` | JSON `{ "paper": { ... } }` |
| GET | `/api/suggest?q=` | Autocomplete suggestions |
| POST | `/api/key` | Save TypeSafe key to `data/typesafe.key` |
| DELETE | `/api/key` | Remove local key |

Live search and scoring need a key, so either set `TYPESAFE_API_KEY` in the environment or save one through `POST /api/key` or the UI. `data/typesafe.key` is gitignored, and keys should never be committed.

## MCP

OpenReach also speaks MCP over stdio, with five tools that wrap the same flows as the HTTP API: `search_papers`, `score_papers`, `more_like_this`, `export_citations`, and `demo_papers`. Start the server with:

```bash
npm run mcp
```

To register it in Cursor, add the following to `mcp.json` and set `cwd` to your OpenReach checkout:

```json
"openreach": {
  "command": "node",
  "args": ["--import", "tsx", "src/mcp.ts"],
  "cwd": "<path-to-OpenReach>"
}
```

Live search and scoring need `TYPESAFE_API_KEY` or `data/typesafe.key`. `demo_papers` and `export_citations` work without a key.

## Deploy

Build once, then serve the UI and `/api/*` from the same process on `PORT`, which defaults to 3000:

```bash
npm run build
npm start
```

Docker works the same way:

```bash
docker build -t openreach .
docker run --rm -p 3000:3000 --env-file .env openreach
```

Pass `TYPESAFE_API_KEY` in through the host environment or the env file at run time. Do not bake `.env` into the image.

## License

MIT — see [LICENSE](LICENSE).
