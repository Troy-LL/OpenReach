# OpenReach

Reach for scientific papers that weren’t findable before. Ask a research question in plain language; OpenReach retrieves candidates across scholarly indexes, then ranks each title and abstract by meaning (via Jev / TypeSafe). Results are paginated (8 per page); only the current page is scored.

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

Specialty indexes activate by research field when intent is known; with no field filter, every index runs so coverage stays dense.

## Local

```bash
npm install
npm run dev
```

UI: http://127.0.0.1:5173  
API: http://127.0.0.1:3000  

The first screen asks for a TypeSafe / Jev key and writes it to `data/typesafe.key` on this machine. That file is gitignored and is never copied into the Docker image. A host `TYPESAFE_API_KEY` still wins if you set one.

`Browse sample results` exercises filters without a live Jev call.

Typing in the search box shows OpenAlex autocomplete suggestions (papers, topics, concepts). Arrow keys move, Enter selects, Escape closes.

```bash
npm test
npm run typecheck
npm run find -- "your question"
```

## Deploy

```bash
npm run build
npm start
```

Serves the UI and `/api/*` on `PORT` (default 3000). Or:

```bash
docker build -t openreach .
docker run --rm -p 3000:3000 --env-file .env openreach
```

Set `TYPESAFE_API_KEY` in the host environment. Do not bake `.env` into the image.

## License

MIT — see [LICENSE](LICENSE).
