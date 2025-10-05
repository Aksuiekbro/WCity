# PRD 3 — Demand, Capacity & Optimization Engine

## 1. Overview
Transition from heuristic “AI planning” to a rigorous facility-allocation engine that models demand, existing capacity, equity goals, and produces explainable recommendations via mathematical optimization.

## 2. Problem Statement
Scoring services describe environmental suitability but do not answer allocation questions (“Where should $5M build clinics?”). Without demand modeling, facility registries, and constraint-aware optimization, recommendations remain anecdotal and cannot be justified in policy settings.

## 3. Target Users
- Health ministries planning new clinics and redistributing capacity.
- Education departments balancing school catchments.
- NGOs designing shelter networks for hazard scenarios.
- Backend research partners evaluating equity and robustness.

## 4. Objectives
1. Represent demand as population × need × vulnerability on a shared planning grid.
2. Maintain a facility registry with capacities, utilization, and service types.
3. Provide optimization endpoints (OR-Tools/Pyomo) with selectable objectives and constraints.
4. Return explainable outputs (selected sites, metrics, trade-offs) consumable by the Planner UI (PRD 4).

## 5. Functional Requirements
- **Demand modeling**: Aggregate WorldPop (age/sex) + vulnerability modifiers into 500 m cells; expose API returning demand vectors per AOI/infrastructure type.
- **Facility registry service**: Ingest OSM/government hospital/school data; store capacity, status, metadata; allow manual overrides.
- **Optimization service**:
  - Input: candidate sites, budget, max facilities, objective, constraints (e.g., avoid flood zones).
  - Output: selected sites, assignment matrix, coverage stats, marginal gains.
  - Support objectives: p-median (min avg time), p-center (min max time), coverage maximization, cost minimization, weighted multi-objective.
- **Equity metrics**: Compute coverage gaps for vulnerable groups, access Gini, per-district stats.
- **Scenario persistence**: Store inputs/outputs with IDs for comparison/export.

## 6. Service Replacement Mapping
| Current Component | Limitation | Replacement / Upgrade | Notes |
|-------------------|------------|-----------------------|-------|
| `planning.service.ts` (heuristic scoring + LLM summary) | No demand, capacity, or budget awareness | **OptimizationService (new)** using **OR-Tools CP-SAT** or **Pyomo + CBC/Gurobi** | Runs facility-location models with explicit constraints |
| `InfrastructureService` fallback recommendations | Text suggestions only, no allocation | Keep for narratives, but base on OptimizationService outputs (served population, equity metrics) | Replace heuristics with metrics-driven summaries |
| Absence of facility registry | Cannot consider existing hospitals/schools | **FacilityRegistryService (new)** ingesting OSM/official datasets | Stores capacity, utilization, service types |
| Lack of demand modeling | Population treated uniformly | **DemandService (new)** built on PRD1 layers | Adds age/need/vulnerability weights per grid cell |

## 7. Data Inputs & Integrations
- Demand grid from PRD1 (WorldPop, INFORM, hazard overlays).
- Travel-time matrices from PRD2 (OSRM-based).
- Facility data: OSM, Ministry of Health/Education registries, HDX datasets.
- Hazard masks (flood, heat) to constrain candidate sites.

## 8. API Sketch
```
POST /optimize
{
  "aoi": {...},
  "infrastructureType": "hospital",
  "budget": 5000000,
  "maxFacilities": 5,
  "objective": "p_median",
  "equityMode": "vulnerable",
  "constraints": {
    "avoidFloodPercentileAbove": 80,
    "maxTravelTime": 45
  }
}
```
Response includes selected sites, metrics, justification snippets, and data provenance.

## 9. Success Metrics
- Solver completes ≤60 s for 200 candidate sites × 500 demand cells.
- Optimization improves avg travel time ≥20% over heuristic baseline in benchmark scenario.
- Each scenario output contains equity metrics and capacity utilization summaries.

## 10. Timeline & Resources
- Requires PRDs 1 & 2. Estimated 8–10 weeks (1 backend + 1 data/optimization engineer).
- Milestones: (1) Demand + facility services, (2) OR-Tools MVP, (3) Equity metrics + scenario persistence.

## 11. Risks & Mitigations
- **Solver scalability** → Pre-cluster candidates, use greedy warm starts, or fallback heuristics for >1k sites.
- **Data gaps (capacity)** → Allow manual overrides, include confidence scores, document assumptions.
- **Explainability** → Persist intermediate metrics (marginal gain per site) for UI narratives.
