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
| Backend | Firebase Hosting (+ optional Analytics) | Static deploy; the app has no server dependency |

Why no map: an interactive Leaflet/Mapbox layer over 4 000+ markers is the single heaviest thing
this page could do, and it answers a worse question than "which arrondissement should I head to?".
A stacked bar chart answers that instantly and stays at 60fps while filters change.

---

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

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

Everything works with **no `.env` at all** — the Open Data Paris API needs no key and Firebase is
optional. To enable Firebase Analytics, copy `.env.example` to `.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_OPENDATA_BASE_URL` | Open Data Paris v2.1 catalog | Point at a proxy or fixture server |
| `VITE_ENABLE_LOGS` | `true` | Set to `false` to silence all non-error logs |
| `VITE_FIREBASE_*` | unset | Optional; absent config is detected and skipped |

---

## Architecture

```
src/
├── types/
│   ├── coolspot.ts        # Unified domain model: CoolSpot, CoolSpotFilter, CoolSpotCategory
│   └── opendata.ts        # Raw wire DTOs, one per dataset (verified against the live API)
├── services/
│   ├── openDataClient.ts  # Transport: URL building, bounded-concurrency pagination, timeouts
│   ├── normalizers.ts     # Pure DTO → CoolSpot adapters, one per dataset
│   └── coolSpotService.ts # Orchestration: parallel fetch, merge, dedupe, degradation policy
├── store/
│   ├── useCoolSpotStore.ts# Zustand: raw state + actions only
│   └── selectors.ts       # Pure derivation functions (filter, sort, paginate, aggregate)
├── hooks/
│   ├── useCoolSpots.ts    # Read model — composes selectors into memoized derived values
│   └── useDebouncedValue.ts
├── components/            # FilterBar, CoolSpotsTable, ArrondissementChart, DashboardMetrics, …
└── lib/
    ├── logger.ts          # Scoped, grouped, timed console logging
    └── firebase.ts        # Guarded, optional Firebase init
```

The dependency direction is strictly one-way: `components → hooks → store → services → types`.
**No component ever sees a raw DTO.**

### Datasets

| Slug | Records | Category | Required |
| --- | --- | --- | --- |
| `fontaines-a-boire` | 1 325 | `fountain` | ✅ |
| `espaces_verts` | 2 534 | `green_space` | ✅ |
| `ilots-de-fraicheur-equipements-activites` | 531 | `indoor` | ⬜ optional |

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
- `manualChunks` splits Recharts and Firebase into separate vendor bundles (app chunk: 68 KB gzipped).
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
UI       Firebase not configured — skipping init (dashboard works without it)
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
| `UI` | `main` / `firebase` / `ErrorBoundary` | Boot sequence and caught render errors |

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

```bash
npm run deploy
```

Builds to `dist/` and deploys to Firebase Hosting (`firebase.json` points `hosting.public` at
`dist`, rewrites all routes to `index.html`, and sets immutable cache headers on hashed assets).

The previous static Firebase demo page lives in `legacy/` for reference; it is not part of the build.

---

## Data source & disclaimer

Data: [Open Data Paris](https://opendata.paris.fr) — Explore API v2.1. Opening hours and fountain
availability change frequently; the app surfaces what the datasets report, and users should verify
on site.
#   P r o j e t - P a r i s  
 