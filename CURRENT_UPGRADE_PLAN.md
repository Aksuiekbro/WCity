# Upgrade Program Index

The comprehensive upgrade plan is now organized into dedicated Product Requirement Documents (PRDs) under `docs/prds/`. Use this index to navigate and schedule each initiative.

| PRD | Title | Scope Snapshot | Key Service Changes |
|-----|-------|----------------|---------------------|
| [PRD 1](docs/prds/PRD1-data-infrastructure.md) | Real Environmental & Socioeconomic Data Infrastructure | Replace heuristic NASA services with authoritative rasters, build ingestion/tiling/query stack. | `PowerService`, `GldasService`, `ModisService`, `SedacService` → MODIS/SMAP/CAMS/WorldPop replacements |
| [PRD 2](docs/prds/PRD2-mobility-accessibility.md) | Network-Aware Mobility & Accessibility Platform | Deploy routing + congestion services for realistic travel-time analytics. | Leaflet distance heuristics → OSRM/HERE-backed `MobilityService` |
| [PRD 3](docs/prds/PRD3-demand-optimization.md) | Demand, Capacity & Optimization Engine | Model demand/capacity and run OR-Tools allocation with equity metrics. | Heuristic `planning.service` → Optimization/Demand/Facility services |
| [PRD 4](docs/prds/PRD4-planner-experience.md) | Planner Experience & Scenario Workflow | Full scenario workspace with metrics, exports, collaboration. | Minimal planning drawer → ScenarioWorkspace, Narrative, Export services |
| [PRD 5](docs/prds/PRD5-robustness-research.md) | Robustness, Equity Analytics & Research Extensions | Multi-scenario stress tests, climate futures, research sandbox. | Single-run planning → ScenarioBatch, Climate-adjusted layers, Research APIs |

Each PRD contains:
- Summary, problem statement, objectives, and success metrics.
- Functional requirements, data/API integrations, timelines, and risks.
- Explicit mapping between current services and the recommended replacements or new services to implement.

Use this document as the entry point when planning sprints, allocating engineering staff, or briefing stakeholders.
