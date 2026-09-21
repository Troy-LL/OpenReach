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

The first screen asks for a TypeSafe / Jev key. The UI keeps it in this browser (`localStorage`). We do not store visitor keys on Cloudflare (no KV, Durable Object, or R2 for keys). Local `npm run dev` and Docker can also write `data/typesafe.key` on this machine for the CLI. If you set `TYPESAFE_API_KEY` in a local environment, it takes precedence there. Never commit a key.

Two things work without a live Jev call: **Browse sample results**, which exercises the filters against fixed sample papers, and the search box itself, which shows OpenAlex autocomplete suggestions for papers, topics, and concepts as you type. Arrow keys move through suggestions, Enter selects, and Escape closes the list.

## Command line

```bash
npm test
npm run typecheck
npm run find -- "your question"
npm run find -- --json --score-first 0 "your question"
npm run find -- --demo
```

`--json` prints a machine-readable payload, `--score-first N` sets how many papers Jev scores immediately (the CLI scores 12 by default, and `0` skips scoring so you see the gated candidates as retrieved), and `--demo` runs against the sample papers without a key. APA and BibTeX export use the author names the indexes returned; if an index omitted names, the citation still says `[Author unknown]`.

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
| POST | `/api/key` | Validate a TypeSafe key (Node also writes `data/typesafe.key`; Workers do not store it) |
| DELETE | `/api/key` | Remove a Node-local key file |
| POST | `/mcp` | Remote MCP Streamable HTTP (key via `X-Typesafe-Key` or Bearer) |

Live search and scoring need a key. The hosted UI sends it on Jev calls via the `X-Typesafe-Key` header from `localStorage`. Locally you can also set `TYPESAFE_API_KEY` or save through `POST /api/key` / the UI to `data/typesafe.key` (gitignored). Keys should never be committed.

## MCP

OpenReach speaks MCP over remote Streamable HTTP and local stdio. The tools are the same: `search_papers`, `score_papers`, `more_like_this`, `export_citations`, and `demo_papers`.

### Remote (no checkout)

The hosted Worker serves **https://openreach.niched.tech/mcp** (same `/mcp` path on the `*.workers.dev` fallback). After you paste a TypeSafe key in the UI, the **Connect MCP** card copies a config block that already includes the key from this browser as `X-Typesafe-Key`. We do not store that key on the server.

```json
{
  "mcpServers": {
    "openreach": {
      "url": "https://openreach.niched.tech/mcp",
      "headers": {
        "X-Typesafe-Key": "<your TypeSafe key>"
      }
    }
  }
}
```

Paste that block into your MCP-capable agent to connect. You can also point the same header at an env value if you prefer not to embed the key. Live tools refuse to run without `X-Typesafe-Key` or `Authorization: Bearer`. `demo_papers` and `export_citations` work without a key. Do not set `TYPESAFE_API_KEY` as a Worker secret.

### Local stdio

From a checkout, start the stdio server with:

```bash
npm run mcp
```

To register the local stdio server in an MCP-capable agent, add a config like this and set `cwd` to your OpenReach checkout:

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

## Deploy to Cloudflare

Production is the Worker named `openreach` on Troy's personal Cloudflare account. The live URL is **https://openreach.niched.tech** (zone `niched.tech`, same pattern as `pupsync` and `may-pasok-ba`). `wrangler.jsonc` binds that hostname as a Workers custom domain and still keeps the `*.workers.dev` fallback.

Build the UI, then deploy from an account that owns zone `niched.tech`:

```bash
npx wrangler login
npm run deploy
```

That runs `vite build` and `wrangler deploy`. If the zone is already on this Cloudflare account, deploy creates the DNS record for `openreach.niched.tech` automatically.

If deploy says the zone is missing or the custom domain cannot be attached, finish it in the dashboard (personal account, not ASES):

1. Workers & Pages → **openreach** → Settings → Domains & Routes → Add → Custom Domain
2. Hostname: `openreach.niched.tech`
3. Cloudflare issues the certificate and a proxied record on `niched.tech`.

No secret is required for TypeSafe / Jev. Visitors paste their own key; it stays in the browser and is sent only on live Jev requests. OpenReach does not persist it in Durable Objects, KV, or R2. The Durable Object binding is for short-lived search sessions (retrieved papers waiting to be scored), not keys.

Optional:

```bash
npx wrangler secret put SEMANTIC_SCHOLAR_API_KEY
npx wrangler secret put OPENALEX_MAILTO
```

Do not set `TYPESAFE_API_KEY` as a Worker secret. The onboarding screen is the source of the key, on this device.

Local `npm run dev` and Docker still use the Node server and may write `data/typesafe.key` for single-machine use.

## License

MIT — see [LICENSE](LICENSE).
