# ❄️ Îlots de Fraîcheur · Paris

A responsive dashboard that helps Parisians and tourists find **cool spots** during heat waves.
It aggregates three heterogeneous Open Data Paris datasets, normalizes them into a single domain
model, and exposes them through multi-dataset filtering, a sortable table that reveals rows in
batches as you scroll, and a
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

Three levels, each self-contained. If you only want to see the dashboard, level 1 is enough.

| Level | What you get | What you must install | Time |
| --- | --- | --- | --- |
| 1 · Dashboard only | The full app, reading Open Data Paris live | Node 18+ | ~2 min |
| 2 · Full stack | MySQL + Go API + ingestion, measured canopy score | Docker Desktop, Go 1.23 | ~15 min |
| 3 · Pipeline & analytics | Python tests, local ingestion, R analysis | Python 3.12, R 4.4 | ~10 min |

### Level 1 — the dashboard alone

No backend, no database, **no API key**. The SPA reads Open Data Paris directly and normalizes in
the browser.

```bash
npm --prefix frontend install
```

```bash
npm --prefix frontend run dev
```

Then open **http://localhost:5173**. You should see **4 388 cool spots**, the per-arrondissement
chart, and the filterable table.

> **Limit of this mode:** with no backend there is no tree register, so the "Fraîcheur" column shows
> the hashed fallback score rather than the measured canopy score. Everything else is identical.

Other frontend scripts:

```bash
npm --prefix frontend run lint
```

```bash
npm --prefix frontend run build
```

`lint` is `tsc --noEmit` (strict TypeScript — there is no ESLint here). `build` writes
`frontend/dist/`.

### Level 2 — the full stack

#### ⚠️ Required first: generate `go.sum`

`services/api-go/go.sum` **is not in the repository** and has never been generated. Without it the
Docker build fails on `COPY go.mod go.sum ./` before it ever compiles, and `go test` / `go vet` fail
with `missing go.sum entry`. It needs **Go 1.23+ and network access**, once:

```bash
cd services/api-go && go mod tidy
```

```bash
cd services/api-go && go test ./... -race -cover
```

Commit `go.sum`: the rest of this section and the CI both depend on it.

#### 1. Environment

```bash
cp deploy/.env.example deploy/.env
```

Fill in the two passwords — there are deliberately **no defaults for secrets**:

| Variable | Fill in | Purpose |
| --- | --- | --- |
| `MYSQL_ROOT_PASSWORD` | ✅ | MySQL root account |
| `MYSQL_PASSWORD` | ✅ | Password for `paris_app`, used by the API |
| `MYSQL_DATABASE` | pre-filled | `paris_fraicheur` |
| `MYSQL_USER` | pre-filled | `paris_app` |
| `ALLOWED_ORIGINS` | pre-filled | Must contain wherever Vite is listening |

`deploy/.env` is gitignored.

#### 2. Bring up MySQL and the API

```bash
docker compose -f deploy/docker-compose.yml up -d
```

`pipeline/sql/` is applied automatically on first boot, on an empty volume. The API waits for MySQL
to report healthy.

#### 3. Load the data

Ingestion is a **one-shot job**, not a service.

```bash
docker compose -f deploy/docker-compose.yml run --rm pipeline
```

Expect **several minutes**: on top of the three datasets it pulls the ~211 000-row tree register to
compute the canopy score. Exit codes: `0` all sources loaded · `1` a required source failed ·
`2` configuration missing.

#### 4. Point the dashboard at the API

```bash
cp frontend/.env.example frontend/.env
```

`VITE_API_BASE_URL=http://localhost:8080` is already there. Restart Vite — `VITE_*` variables are
read at startup, not hot-reloaded.

| Service | URL | Notes |
| --- | --- | --- |
| Dashboard | http://localhost:5173 | Vite dev server, started separately |
| Go API | http://localhost:8080/api/v1/coolspots | MySQL-backed, paginated |
| Liveness | http://localhost:8080/healthz | Answers without touching the database |
| Readiness | http://localhost:8080/readyz | `503` when MySQL is unreachable |
| MySQL | `localhost:3306` | Port configurable via `MYSQL_PORT` |

```bash
curl "http://localhost:8080/api/v1/coolspots?arrondissement=75004&category=fountain&pageSize=5"
```

Stop with `docker compose -f deploy/docker-compose.yml down`. Add `-v` to drop the MySQL volume too
— required if you change `pipeline/sql/001_schema.sql`, since init scripts only replay on an empty
volume.

#### Working on the API without Docker

`services/api-go/` ships a `Makefile`: `make run`, `make test` (race + coverage), `make lint`
(`go vet` + `gofmt -l`), `make build`, `make tidy`.

Configuration is entirely environmental — `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`,
`PORT`, `ALLOWED_ORIGINS`, `TRUST_PROXY`. `DB_DSN` short-circuits the `DB_*` parts. `DB_PASSWORD`
(or `DB_DSN`) is the only mandatory setting.

> Set `TRUST_PROXY=true` only behind a load balancer that writes `X-Forwarded-For`. Exposed
> directly, that header is attacker-controlled.

### Level 3 — pipeline and analytics locally

```bash
python -m pip install -r pipeline/requirements-dev.txt
```

The tests touch no database:

```bash
cd pipeline && python -m pytest -q
```

```bash
cd pipeline && python -m ruff check .
```

For a real ingestion, export the `DB_*` variables then run `python -m paris_pipeline.run`.

```bash
Rscript analytics/r/install_deps.R
```

```bash
Rscript analytics/r/vulnerability_index.R
```

### Environment variables

Everything works with **no `.env` at all** — the Open Data Paris API needs no key, and the backend
is optional. Copy `frontend/.env.example` to `frontend/.env` to change any of:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | unset | Origin of the Go API. Unset ⇒ normalize Open Data in the browser |
| `VITE_OPENDATA_BASE_URL` | Open Data Paris v2.1 catalog | Point at a proxy or fixture server |
| `VITE_ENABLE_LOGS` | `true` | Set to `false` to silence all non-error logs |

### Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `COPY go.mod go.sum` fails in the Docker build | `go.sum` missing | `cd services/api-go && go mod tidy`, then commit it |
| `missing go.sum entry` on `go test` | same | same |
| Dashboard shows 4 388 spots but round-looking scores | No backend wired in | Set `VITE_API_BASE_URL`, restart Vite |
| Dashboard stays empty | Open Data Paris unreachable, or `VITE_API_BASE_URL` points at a dead API | Open the console — every call is logged with its timing |
| CORS error in the console | Vite's origin is not in `ALLOWED_ORIGINS` | Fix `deploy/.env`, then `up -d` again |
| `/readyz` returns `503` | API is up, MySQL is not | `docker compose -f deploy/docker-compose.yml logs mysql` |
| Schema change not picked up | Init scripts only replay on an empty volume | `down -v` then `up -d` |
| `MYSQL_ROOT_PASSWORD ... variable is not set` | `deploy/.env` missing or incomplete | Start again from `deploy/.env.example` |

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
│   └── selectors.ts       # Pure derivation functions (filter, sort, reveal, aggregate)
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
- Sorting, filtering and row reveal are memoized independently — revealing the next batch does not
  re-filter or re-sort the 4 388 rows.
- The table mounts rows in batches of 70 (`ROWS_PER_BATCH`), extended by an `IntersectionObserver`
  on a sentinel below the last row, with a 600px `rootMargin` so the rows exist before they are
  scrolled to. Any filter or sort change resets the reveal to the first batch.
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

## Manual setup

Everything in this repository is written and committed. What follows needs an account, a card, or a
machine-local install — it cannot be done from the repo. Each section is independent of the ones
below it.

### 1. Retire the old Firebase project (do this first)

The web API key `AIzaSy…FXPEM` is still in this repository's git history and is tied to a live
project. Not a secret in the strict sense, but it identifies a real billable project.

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) → delete
   the browser key for `projet-paris-6bf57`.
2. [Firebase Console](https://console.firebase.google.com) → project settings → delete the project.

### 2. Local toolchain

| Tool | Needed for | Check |
| --- | --- | --- |
| Node 22+ | frontend | `node --version` |
| Go 1.23+ | `services/api-go` | `go version` |
| Docker Desktop | the compose stack | `docker --version` |
| Python 3.12+ | `pipeline` | `python --version` |
| R 4.4 + RStudio | `analytics/r` | `Rscript --version` |

Nothing in the repo depends on a missing tool until you run the service that uses it. After
installing Go, run `go mod tidy` in `services/api-go` — `go.sum` is not committed and that command
is what writes it.

### 3. Google Cloud

```bash
gcloud auth login
```

```bash
gcloud config set project YOUR_PROJECT_ID
```

```bash
gcloud services enable appengine.googleapis.com sqladmin.googleapis.com run.googleapis.com artifactregistry.googleapis.com cloudscheduler.googleapis.com
```

```bash
gcloud app create --region=europe-west1
```

Billing must be enabled before App Engine will accept a deploy.

### 4. Cloud SQL (MySQL 8)

1. Create the instance (console or `gcloud sql instances create`), region `europe-west1`.
2. Note the **connection name** — `project:region:instance`. Both the Go API and the pipeline read
   it from `INSTANCE_CONNECTION_NAME`.
3. Create the database:

```bash
gcloud sql databases create paris_fraicheur --instance=YOUR_INSTANCE
```

Then three users with least privilege rather than one shared account:

| User | Grants | Used by |
| --- | --- | --- |
| `paris_api` | `SELECT` everywhere, plus `INSERT` on `citizen_reports` | `services/api-go` |
| `paris_pipeline` | `SELECT, INSERT, UPDATE, DELETE` | the ingestion job |
| `paris_analytics` | `SELECT`, plus write on `arrondissement_scores` | `analytics/r` |

4. Apply the schema — the compose stack does this automatically, so this is for Cloud SQL only:

```bash
mysql -h YOUR_HOST -u root -p < pipeline/sql/001_schema.sql
```

```bash
mysql -h YOUR_HOST -u root -p < pipeline/sql/002_seed.sql
```

### 5. GitLab

Settings → CI/CD → Variables:

| Variable | Type | Flags |
| --- | --- | --- |
| `GCP_PROJECT_ID` | variable | protected |
| `GCP_SA_KEY` | file | protected, masked |

The service account needs `roles/appengine.deployer`, `roles/appengine.serviceAdmin`,
`roles/cloudbuild.builds.editor` and `roles/storage.admin`.

### 6. Schedule the ingestion

Locally a cron entry running the compose job is enough. In GCP, deploy `pipeline/Dockerfile` as a
Cloud Run job and add a daily Cloud Scheduler trigger. That is the whole scheduling story — this
replaced an Airflow deployment precisely because it does not need one.

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
