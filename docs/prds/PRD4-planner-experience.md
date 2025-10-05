# PRD 4 — Planner Experience & Scenario Workflow

## 1. Overview
Upgrade the AI Planning UI into a professional scenario workspace where users configure constraints, run optimization jobs, compare outcomes, and export shareable artifacts.

## 2. Problem Statement
The current planning drawer offers limited inputs (hazards, budgets) and opaque outputs, preventing adoption by municipal planners who must defend decisions, iterate with peers, and archive scenarios.

## 3. Target Users
- City planning departments iterating on multiple budget options.
- NGOs collaborating on shelter placement proposals.
- Consultants producing reports that require map exports and narrative justifications.

## 4. Objectives
1. Provide a structured scenario creation flow that captures hazards, infrastructure type, budgets, and equity settings.
2. Visualize optimization outputs (from PRD 3) with interactive maps, metrics, and explainable narratives.
3. Enable comparison, export (GeoJSON/PDF), and collaboration through saved scenarios.

## 5. Functional Requirements
- **Scenario form**: Multi-step UI collecting AOI, infrastructure type, hazards + thresholds, budget, max facilities, equity mode, exclusion zones.
- **Map visualization**: Display proposed vs. existing facilities, 10/20/30 min isochrones, hazard overlays, draggable exclusions.
- **Metrics dashboard**: Before/after stats (avg & max travel time, vulnerable coverage, cost, utilization). Travel-time histogram and equity gauges.
- **Scenario comparison**: Table and side-by-side map toggle for multiple saved runs; highlight deltas and trade-offs.
- **Narrative explanations**: Auto-generate text referencing data drivers (population served, hazard avoidance) using templated summaries or LLM with cached prompts.
- **Exports**: GeoJSON (points + catchments), PDF report (map snapshots, metrics, data provenance), CSV of metrics.
- **Collaboration roadmap**: Scenario sharing links, comments, audit trail of edits.

## 6. Service Replacement Mapping & Implementation Details
| Current Component | Limitation | Upgrade / New Service | API Endpoint & Implementation | Implementation Notes |
|-------------------|------------|-----------------------|-------------------------------|----------------------|
| `planning-panel` Vue component (minimal inputs, heuristic outputs) | Limited configurability, no saved scenarios | **ScenarioWorkspace** components (forms, comparison tables, map overlays) consuming OptimizationService APIs | **Frontend**: Multi-step form with Vue composables: `useScenarioForm()`, `useScenarioComparison()`, `useMapOverlay()`. Store scenarios in Vuex/Pinia: `scenarios: { [id]: {...} }`. **Backend**: `POST /api/scenarios` to save, `GET /api/scenarios` to list, `GET /api/scenarios/{id}` to load. Store in Postgres: table `scenarios` with columns `id, user_id, name, config (JSONB), results (JSONB), created_at`. | Use Vuelidate or VeeValidate for form validation. Map overlays: Use Leaflet layer groups to toggle scenarios. Comparison table: Reactively compute deltas (e.g., `scenario_a.avgTime - scenario_b.avgTime`). |
| `InfrastructureService` text summaries detached from metrics | Hard to justify to planners | Replace with `ScenarioNarrativeService` that ingests optimization metrics + data provenance | `POST /api/scenarios/{id}/narrative` returns `{ "summary": "...", "siteExplanations": [{siteId, text}, ...] }`. Use templates: `"Site #{{siteId}} serves {{popServed}} people (incl {{vulnerableServed}} vulnerable) within {{avgTime}} min. Hazard risk: {{riskLevel}}."`. Optionally call OpenAI API: `POST https://api.openai.com/v1/chat/completions` with system prompt + structured data. | Optionally backed by LLM but grounded in metrics. Cache LLM responses per scenario hash (TTL 30 days). Use template engine (e.g., Handlebars.js or Nunjucks) for deterministic text. Fallback: If LLM unavailable, use templates only. |
| No export pipeline | Users cannot include outputs in reports | **ExportService** (PDF via WeasyPrint/pdfkit, GeoJSON download, CSV) | `GET /api/scenarios/{id}/export?format=geojson` returns `{ "type": "FeatureCollection", "features": [...] }`. `GET /api/scenarios/{id}/export?format=pdf` generates PDF with map snapshots (via Puppeteer/headless Chrome or MapLibre static rendering), metrics tables, narratives. Use WeasyPrint (Python) or pdfkit (Node.js). `GET /api/scenarios/{id}/export?format=csv` returns metrics as CSV. | **PDF**: Render HTML template with embedded map (Leaflet.SimpleMapScreenshoter or static MapLibre image), convert to PDF via WeasyPrint (`pip install weasyprint`). **GeoJSON**: Serialize selected sites + isochrones as Features. **CSV**: Use `json2csv` library (Node.js) or pandas (Python). Include metadata header (scenario name, date, provenance). |

## 7. UI/UX Enhancements

### Scenario Creation Flow (Multi-Step Form)
**Step 1: Define Area**
- Map interaction: Draw polygon or use current viewport as AOI.
- Store bounds: `{ north, south, east, west }` or polygon GeoJSON.

**Step 2: Configure Infrastructure**
- Dropdown: Hospital, School, Shelter, Fire Station.
- Budget slider: $0–$50M (step $100k).
- Max facilities slider: 1–20.

**Step 3: Hazards & Constraints**
- Multi-select: Flood, Heat, Air Quality, Earthquake.
- For each hazard, threshold slider (e.g., "Avoid sites with >80th percentile flood risk").
- Exclusion zones: Draw on map (e.g., protected areas, private land).

**Step 4: Equity & Objectives**
- Radio buttons: "Minimize average travel time" (p-median) vs. "Minimize maximum travel time" (p-center).
- Equity toggle: "Prioritize vulnerable populations" (applies weight).
- Max travel time constraint: Slider (15–60 min).

**Step 5: Review & Run**
- Summary card showing all inputs.
- "Run Optimization" button → calls `POST /api/optimize`.
- Loading spinner + progress bar (optional: WebSocket for real-time status).

### Results Visualization
**Map Layer**:
- Selected sites: Numbered pins (color-coded by priority: red=high, orange=medium, green=low).
- Isochrones: 10/20/30 min contours (different colors/opacities).
- Existing facilities: Gray circles.
- Toggle: "Show all" vs. "Show top 5".

**Side Panel (Site Details)**:
- Click site pin → show card:
  - **Metrics**: Population served, avg/max travel time, cost, hazard scores.
  - **Narrative**: Auto-generated justification (from `ScenarioNarrativeService`).
  - **Actions**: "Exclude site" (re-run optimization with blacklist), "View catchment" (show isochrone).

**Metrics Dashboard**:
- Cards: Total cost, avg travel time, max travel time, coverage (general / vulnerable), equity Gini.
- Before/after comparison: Bar charts (Chart.js or D3.js).
- Travel time distribution: Histogram (x-axis: time bins, y-axis: population count).

### Scenario Comparison
**Table View**:
| Metric | Current | Scenario A | Scenario B | Delta (A vs B) |
|--------|---------|------------|------------|----------------|
| Avg travel time | 35 min | 22 min | 25 min | -3 min |
| Max travel time | 90 min | 45 min | 60 min | -15 min |
| Coverage (vulnerable) | 60% | 85% | 80% | +5% |
| Total cost | $0 | $5M | $3M | +$2M |

**Map Toggle**:
- Dropdown: "Show Scenario A" / "Show Scenario B" / "Show Both".
- When both: Use different colors/icons (A = blue pins, B = green pins).

### Export Workflows
**GeoJSON Export**:
- Button: "Download GeoJSON" → triggers `GET /api/scenarios/{id}/export?format=geojson`.
- File: `scenario_abc123_sites.geojson` (FeatureCollection with Point features for sites, Polygon features for isochrones).
- Metadata in properties: `{ "scenarioName": "...", "date": "...", "provenance": {...} }`.

**PDF Report**:
- Button: "Generate PDF Report" → backend renders HTML, converts to PDF.
- Contents:
  1. Cover page: Scenario name, date, author.
  2. Map snapshot (A4 landscape, 300dpi).
  3. Metrics table.
  4. Site-by-site explanations (1 paragraph each).
  5. Data provenance (sources, versions, update dates).
- Use template: `report_template.html` with Jinja2 or Handlebars.

**CSV Export**:
- Button: "Download Metrics CSV" → triggers `GET /api/scenarios/{id}/export?format=csv`.
- Columns: `siteId, lat, lng, priority, popServed, vulnerableServed, avgTime, maxTime, cost, hazardRisk`.

## 8. API Endpoints Summary
| Endpoint | Method | Description | Request Body / Params | Response |
|----------|--------|-------------|-----------------------|----------|
| `/api/scenarios` | POST | Save scenario | `{ name, config, results }` | `{ id, ... }` |
| `/api/scenarios` | GET | List scenarios | Query: `?user_id={id}` | `[{ id, name, created_at }, ...]` |
| `/api/scenarios/{id}` | GET | Load scenario | Path: `{id}` | `{ id, name, config, results, ... }` |
| `/api/scenarios/{id}` | PUT | Update scenario | `{ name, config, results }` | `{ id, ... }` |
| `/api/scenarios/{id}` | DELETE | Delete scenario | Path: `{id}` | `204 No Content` |
| `/api/scenarios/{id}/narrative` | POST | Generate narrative | Path: `{id}` | `{ summary, siteExplanations }` |
| `/api/scenarios/{id}/export` | GET | Export scenario | Query: `?format=geojson\|pdf\|csv` | File download |

## 9. Success Metrics
- Usability test: ≥3 planners complete creation + comparison of two scenarios in <30 minutes.
- ≥1 scenario export accepted into an external proposal/report pilot.
- Support tickets asking "why was site X selected?" reduced by 50% once narratives + metrics ship.

## 10. Timeline & Resources
- Depends on PRD 3 outputs. Estimated 6–8 weeks (1 frontend engineer, 0.5 backend for exports + narratives, 0.5 designer/researcher for UX).

## 11. Risks & Mitigations
- **Front-end complexity** → Modularize forms and charts; use design tokens for consistent styling.
- **LLM cost/latency** → Default to deterministic templated text; cache any LLM responses per scenario.
- **Export accuracy** → Implement regression tests comparing reference PDFs/GeoJSON to ensure stability.
