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

## 6. Service Replacement Mapping
| Current Component | Limitation | Upgrade / New Service | Notes |
|-------------------|------------|-----------------------|-------|
| `planning-panel` Vue component (minimal inputs, heuristic outputs) | Limited configurability, no saved scenarios | **ScenarioWorkspace** components (forms, comparison tables, map overlays) consuming OptimizationService APIs | Build reusable composables for forms, metrics, exports |
| `InfrastructureService` text summaries detached from metrics | Hard to justify to planners | Replace with `ScenarioNarrativeService` that ingests optimization metrics + data provenance | Optionally backed by LLM but grounded in metrics |
| No export pipeline | Users cannot include outputs in reports | **ExportService** (PDF via WeasyPrint/pdfkit, GeoJSON download, CSV) | Ensure consistent styling + metadata |

## 7. Success Metrics
- Usability test: ≥3 planners complete creation + comparison of two scenarios in <30 minutes.
- ≥1 scenario export accepted into an external proposal/report pilot.
- Support tickets asking “why was site X selected?” reduced by 50% once narratives + metrics ship.

## 8. Timeline & Resources
- Depends on PRD 3 outputs. Estimated 6–8 weeks (1 frontend engineer, 0.5 backend for exports + narratives, 0.5 designer/researcher for UX).

## 9. Risks & Mitigations
- **Front-end complexity** → Modularize forms and charts; use design tokens for consistent styling.
- **LLM cost/latency** → Default to deterministic templated text; cache any LLM responses per scenario.
- **Export accuracy** → Implement regression tests comparing reference PDFs/GeoJSON to ensure stability.
