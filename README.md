# ❄️ Îlots de Fraîcheur · Paris

A responsive dashboard that helps Parisians and tourists find **cool spots** during heat waves.
It aggregates three heterogeneous Open Data Paris datasets, normalizes them into a single domain
model, and exposes them through multi-dataset filtering, a sortable/paginated table, and a
filter-reactive distribution chart.

**4 388 cool spots** across all 20 arrondissements, loaded live from the Open Data Paris API.

---

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | React 19 + Vite 6 + TypeScript (strict) | Fast HMR, no framework overhead for a client-only read model |
| State | Zustand 5 | Single store, no provider tree; actions are plain functions, trivially testable |
| Derived state | `useCoolSpots()` + `useMemo` | Pure selectors memoized on real inputs — no selector allocating a fresh object per store write |
| Styling | Tailwind CSS 3 | Utility-first, responsive breakpoints colocated with markup |
| Charts | Recharts | Declarative, responsive, and light enough to re-render on every filter change |
| API | Go 1.23 (stdlib `net/http`) | One static binary, no framework. Reads are the whole job and the query surface is small; Symfony would need PHP-FPM, nginx and an ORM to do less |
| Database | MySQL 8 (Cloud SQL) | Reference data with real constraints, plus citizen-report writes |
| Ingestion | Python, run as a job | Three daily fetches. A script on a schedule, not an orchestrator |
| Analytics | R + RStudio | Heat-vulnerability index and k-means, over measured tree density |
| Hosting | Google App Engine + Cloud SQL | Static SPA on GAE, API on Cloud Run, one project |
| CI/CD | GitLab CI | lint → test → build → manual deploy |

Why no map: an interactive Leaflet/Mapbox layer over 4 000+ markers is the single heaviest thing
this page could do, and it answers a worse question than "which arrondissement should I head to?".
A stacked bar chart answers that instantly and stays at 60fps while filters change.

---

## Getting started

### Just the dashboard

No backend, no database, no keys — the SPA falls back to reading Open Data Paris directly:

```bash
npm --prefix frontend install
```

```bash
npm --prefix frontend run dev
```

Then open http://localhost:5173.

### With the backend

```bash
cp deploy/.env.example deploy/.env
```

Fill in the passwords, then bring up MySQL and the API:

```bash
docker compose -f deploy/docker-compose.yml up -d
```

Load the data (a few minutes — it also pulls the ~200k-row tree register):

```bash
docker compose -f deploy/docker-compose.yml run --rm pipeline
```

| Service | URL | Notes |
| --- | --- | --- |
| Go API | http://localhost:8080/api/v1/coolspots | MySQL-backed, paginated |
| MySQL | `localhost:3306` | Schema and seed applied on first boot |

Set `VITE_API_BASE_URL=http://localhost:8080` in `frontend/.env` to make the dashboard read the API
instead of Open Data Paris.

Other scripts:

```bash
npm run lint
```

```bash
npm run build
```

```bash
npm run deploy
```

### Environment

Everything works with **no `.env` at all** — the Open Data Paris API needs no key, and the backend
is optional. Copy `frontend/.env.example` to `frontend/.env` to change any of:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | unset | Origin of the Go API. Unset ⇒ normalize Open Data in the browser |
| `VITE_OPENDATA_BASE_URL` | Open Data Paris v2.1 catalog | Point at a proxy or fixture server |
| `VITE_ENABLE_LOGS` | `true` | Set to `false` to silence all non-error logs |

---

## Architecture

```
   Open Data Paris                         python -m paris_pipeline.run
   ├── fontaines-a-boire      ──┐          (cron / Cloud Scheduler, daily)
   ├── espaces_verts          ──┼─→ normalize ─→ score canopy ─→ MySQL
   ├── ilots-de-fraicheur     ──┘                     ↑            │
   └── les-arbres (~200k)     ─────────────────────────┘           │
                                                                   │
                        R ──→ vulnerability index ────────────────→┤
                                                                   │
                                          Go API ←─────────────────┘
                                             ↑
                                    React SPA (App Engine)
```

| Directory | What lives there |
| --- | --- |
| `frontend/` | React 19 + Vite dashboard (deployed to App Engine) |
| `services/api-go/` | Go API — spot reads and citizen-report writes |
| `pipeline/sql/` | MySQL schema and seed — the one owner of the DDL |
| `pipeline/paris_pipeline/` | Extract, normalize, canopy-score, load |
| `analytics/r/` | Heat-vulnerability index, k-means, RMarkdown report |
| `deploy/` | docker-compose stack |

### What was deliberately left out

An earlier pass ran Airflow, BigQuery, Metabase and a second backend in Symfony. All four were cut,
because the numbers do not justify them:

| Removed | Why |
| --- | --- |
| **Airflow** | Three HTTP fetches on a daily timer. It brought a scheduler, a webserver and its own Postgres to do a cron job's work — and Cloud Composer costs ~$300/month. Retries, per-source isolation and run bookkeeping all survive in `run.py`; only the cluster is gone |
| **BigQuery** | Twenty aggregate rows per day. A decade of that is ~73k rows, which MySQL answers instantly from `arrondissement_history` |
| **Metabase** | A BI container over aggregates the dashboard already charts |
| **Symfony** | A second backend for two endpoints. `POST /api/v1/reports` in Go does the same work with one binary and no ORM |

### The canopy score is measured, not invented

`canopyScore` used to be a hash of the record id — stable, plausible-looking, and meaningless, which
made everything computed on top of it decorative. It is now derived from the city's `les-arbres`
register: the pipeline counts registered trees within 300 m of each spot, using a uniform grid so
4 400 spots × 200 000 trees stays a few million distance checks rather than a billion.

The score blends that count with a per-category baseline — an air-conditioned library is cool
whether or not the street is planted, so trees decide only 25% of its score against 70% for a
fountain. Full marks are pegged to the 95th percentile rather than the maximum, so one circle inside
the Bois de Vincennes cannot flatten the rest of the city.

### One definition of a spot

`pipeline/paris_pipeline/normalize.py` is a deliberate port of
`frontend/src/services/normalizers.ts` — same rules, same ids. The pipeline runs them once a day
server-side; the browser still runs them when no API is configured. `hash_score` reproduces
JavaScript's 32-bit `| 0` wrap exactly (verified against an independent int32 implementation over
3 000 fuzz cases), so ids and fallback scores match across the two paths.

That duplication is the deliberate trade: the dashboard must render on a fresh clone with no
infrastructure, and the API must not require the browser to page 4 500 records. Note that the
fallback path is genuinely degraded — without the backend there is no tree data, so it shows the
hashed baseline rather than the measured canopy score.

### Frontend

```
frontend/src/
├── types/
│   ├── coolspot.ts        # Unified domain model: CoolSpot, CoolSpotFilter, CoolSpotCategory
│   └── opendata.ts        # Raw wire DTOs, one per dataset (verified against the live API)
├── services/
│   ├── openDataClient.ts  # Transport: URL building, bounded-concurrency pagination, timeouts
│   ├── normalizers.ts     # Pure DTO → CoolSpot adapters, one per dataset
│   ├── apiClient.ts       # Go backend client — paginated, degrades to the Open Data path
│   └── coolSpotService.ts # Orchestration: source selection, merge, dedupe, degradation policy
├── store/
│   ├── useCoolSpotStore.ts# Zustand: raw state + actions only
│   └── selectors.ts       # Pure derivation functions (filter, sort, paginate, aggregate)
├── hooks/
│   ├── useCoolSpots.ts    # Read model — composes selectors into memoized derived values
│   └── useDebouncedValue.ts
├── components/            # FilterBar, CoolSpotsTable, ArrondissementChart, DashboardMetrics, …
└── lib/
    └── logger.ts          # Scoped, grouped, timed console logging
```

The dependency direction is strictly one-way: `components → hooks → store → services → types`.
**No component ever sees a raw DTO.**

### Datasets

| Slug | Records | Category | Required |
| --- | --- | --- | --- |
| `fontaines-a-boire` | 1 325 | `fountain` | ✅ |
| `espaces_verts` | 2 534 | `green_space` | ✅ |
| `ilots-de-fraicheur-equipements-activites` | 531 | `indoor` | ⬜ optional |
| `les-arbres` | ~211 000 | — (canopy scoring) | ⬜ optional, backend only |

`les-arbres` is pulled through the bulk export endpoint rather than paged: 100 rows at a time would
be ~2 100 requests.

### The normalization problem

The three schemas agree on almost nothing, which is the actual engineering content of this project:

| Field | `fontaines-a-boire` | `espaces_verts` | `ilots-…-activites` |
| --- | --- | --- | --- |
| Geo point | `geo_point_2d` | **`geom_x_y`** | `geo_point_2d` |
| Arrondissement | `commune`: `"PARIS 14EME ARRONDISSEMENT"` | `adresse_codepostal`: `"75020"` (no arrondissement column at all) | `arrondissement`: `"75017"` |
| Name | `modele` / `type_objet`: `"BORNE_FONTAINE"` | `nom_ev` — sometimes an internal code like `"31-09_j"` | `nom` |
| Free | implicit (always) | implicit (always) | `payant`: `"Oui"`/`"Non"` |
| Address | 3 columns, `0` used as "no number" | 4 columns | 1 column |

`normalizeArrondissement()` therefore accepts *candidates in order of reliability* and tries a
postal-code match, then an ordinal-text match (`14EME` → `75014`), including the `75116 → 75016`
alternate code. Every adapter is a pure function, so each of these rules is unit-testable in isolation.

Other normalization decisions worth naming in review:

- **`isFree` defaults to paying when unknown** — a "free only" filter that over-promises is worse
  than one that under-promises.
- **Fountains surface availability as `openingHours`** (`dispo: "NON"` → `Hors service — App A Réparer`),
  because during a heat wave "is it working?" *is* the access question.
- **Code-like names are replaced by their type** — `espaces_verts` labels périphérique plantings
  `00-03` / `17-05b`; anything with fewer than three letters falls back to `type_ev`.
- **`espaces_verts` uses a server-side `select`** to exclude its `geom` MultiPolygon column, which
  is several hundred KB per page of otherwise unused geometry.

### Resilience

- **Graceful degradation** — datasets are marked `required` or not. An optional dataset failing
  shows an amber "partial results" banner; the page stays fully usable. Only losing *every*
  required dataset produces the full error state with a retry button.
- **Cancellation** — each `fetchAllDatasets()` aborts the previous in-flight run via `AbortController`,
  composed with a 15s per-request `AbortSignal.timeout`. React 19 StrictMode's double-mount is
  therefore free rather than duplicated work.
- **Error boundaries** wrap the chart and the table independently, so a Recharts crash cannot take
  the table down with it.
- **Bounded-concurrency pagination** — the first page reveals `total_count`, remaining offsets are
  fetched in windows of 4. This cut `espaces_verts` from **14.8s → 5.7s** without firing 26
  simultaneous requests at an anonymous-rate-limited API.

### Performance & a11y notes

- Search input is debounced at 250 ms with local draft state, so typing never blocks on filtering 4 388 rows.
- Sorting/filtering/pagination are memoized independently — changing the page does not re-filter.
- `manualChunks` splits Recharts into its own vendor bundle (app chunk: 77 KB gzipped).
- Table headers carry `aria-sort`; the toggle is a real `role="switch"`; the drawer is a focus-managed
  `role="dialog"` with Escape-to-close; the result count is an `aria-live` region.
- Unknown arrondissements are pinned last in **both** sort directions — reversing a sort should not
  push a wall of `—` rows to the top.

---

## Live logging strategy (code walkthrough)

`src/lib/logger.ts` provides scoped, color-tagged, timed logging designed to narrate the data
pipeline during a technical review. Open DevTools → Console and reload; the pipeline tells its own
story top to bottom:

```
UI       booting — React development build
STORE    fetchAllDatasets() → loading
ADAPTER  ▶ fetchAllCoolSpots — aggregate + normalize
  API    ▶ GET fontaines-a-boire (max 1400)
  API      fontaines-a-boire: total_count=1325, fetching up to 1325
  API      fontaines-a-boire: 1325 raw records received      ⏱ 1_842 ms
  ADAPTER  fontaines-a-boire: normalized 1325 CoolSpot(s)  { id: "fountain:450024987", … }
  API    ▶ GET espaces_verts (max 2600)                       ⏱ 5_742 ms
  …
  [adapter] de-duplicated 2 record(s) with colliding ids
  ┌─────────┬──────────────────────────┬──────┬────────────┬───────┐
  │ dataset │ status                   │ raw  │ normalized │ error │
  ├─────────┼──────────────────────────┼──────┼────────────┼───────┤
  │ 0       │ 'fontaines-a-boire'  ok  │ 1325 │ 1325       │ '—'   │
  └─────────┴──────────────────────────┴──────┴────────────┴───────┘
  ADAPTER  unified dataset ready: 4388 CoolSpot(s)             ⏱ 5_762 ms
STORE    state hydrated with 4388 item(s) { datasets: 3 }
STORE    setFilter(category) 'indoor'
STORE    setSort() { column: 'arrondissement', direction: 'desc' }
```

Four scopes, each with its own color tag, mapping 1:1 onto the architecture layers:

| Scope | Layer | What it proves in a demo |
| --- | --- | --- |
| `API` | `openDataClient` | Real network calls, real `total_count`, per-dataset timings |
| `ADAPTER` | `normalizers` + `coolSpotService` | Heterogeneous → unified, with a sample `CoolSpot` and a summary table |
| `STORE` | `useCoolSpotStore` | Every user action is a named, logged transition |
| `UI` | `main` / `ErrorBoundary` | Boot sequence and caught render errors |

Suggested demo order:

1. **Reload with the console open** — the whole pipeline narrates itself, with timings.
2. **Expand the `ADAPTER` group** — show one raw DTO next to its normalized `CoolSpot`.
3. **Click a category pill, then the "free only" toggle** — `STORE` logs each transition; the KPIs,
   the chart, and the table all re-derive from the same `filteredItems`.
4. **Type in the search box** — one `setFilter(query)` log per debounce window, not per keystroke.
5. **Search `zzzz`** — table and chart both hit their empty states, with a reset affordance.
6. **Set `VITE_ENABLE_LOGS=false`** — errors still log; everything else goes silent.

To demo graceful degradation, break the optional dataset's slug in
`src/services/coolSpotService.ts` (`COOL_FACILITIES.slug`) and reload: an `API` error is logged, the
amber banner appears, and the other 3 859 spots still render.

---

## Deployment

### Frontend → Google App Engine

```bash
npm --prefix frontend run deploy
```

Builds to `frontend/dist/` and runs `gcloud app deploy`. `frontend/app.yaml` serves hashed assets
with immutable cache headers and rewrites everything else to `index.html` for the SPA router.

### API → Cloud Run

`services/api-go` ships a Debian-based `Dockerfile`. Build, push to Artifact Registry, deploy to
Cloud Run with the Cloud SQL connector attached — setting `INSTANCE_CONNECTION_NAME` switches the
service to the unix socket automatically. Set `TRUST_PROXY=true` there so the report rate limiter
keys on the real client rather than on the load balancer.

### Pipeline → Cloud Run job

`pipeline/Dockerfile` builds the same one-shot job the compose stack runs. Deploy it as a Cloud Run
job and point a daily Cloud Scheduler trigger at it. That is the whole scheduling story.

### CI/CD

`.gitlab-ci.yml` runs typecheck, `go test -race`, `pytest` and `ruff` on every push, and gates the
App Engine deploy behind a manual job on the default branch. It needs two CI variables:
`GCP_PROJECT_ID` and `GCP_SA_KEY`.

---

## Data source & disclaimer

Data: [Open Data Paris](https://opendata.paris.fr) — Explore API v2.1. Opening hours and fountain
availability change frequently; the app surfaces what the datasets report, and users should verify
on site.
#   P r o j e t - P a r i s 
 
 