# PRD 3 — Demand, Capacity & Optimization Engine

## 1. Overview
Transition from heuristic "AI planning" to a rigorous facility-allocation engine that models demand, existing capacity, equity goals, and produces explainable recommendations via mathematical optimization.

## 2. Problem Statement
Scoring services describe environmental suitability but do not answer allocation questions ("Where should $5M build clinics?"). Without demand modeling, facility registries, and constraint-aware optimization, recommendations remain anecdotal and cannot be justified in policy settings.

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

## 6. Service Replacement Mapping & Implementation Details
| Current Component | Limitation | Replacement / Upgrade | API Endpoint & Implementation | Implementation Notes |
|-------------------|------------|-----------------------|-------------------------------|----------------------|
| `planning.service.ts` (heuristic scoring + LLM summary) | No demand, capacity, or budget awareness | **OptimizationService (new)** using **OR-Tools CP-SAT** or **Pyomo + CBC/Gurobi** | `POST /api/optimize` with JSON: `{ "aoi": {...}, "infrastructureType": "hospital", "budget": 5000000, "maxFacilities": 5, "objective": "p_median", "equityMode": "vulnerable", "constraints": {...} }`. Returns `{ "selectedSites": [{lat, lng, priority, reason}, ...], "metrics": {...}, "assignments": [...], "provenance": {...} }`. | **OR-Tools**: Install via `pip install ortools`. Use CP-SAT solver for integer programs. Example: `model = cp_model.CpModel(); x = {s: model.NewBoolVar(f'x_{s}') for s in sites}; model.Minimize(sum(...)); solver = cp_model.CpSolver(); status = solver.Solve(model)`. Timeout: 60s. Fallback: greedy heuristic if unsolved. |
| `InfrastructureService` fallback recommendations | Text suggestions only, no allocation | Keep for narratives, but base on OptimizationService outputs (served population, equity metrics) | Enhance `planning.service.ts` to call `/api/optimize`, parse results, generate narrative: `"Site #1 serves 12k people (incl 3k elderly) within 20 min. Low flood risk (10th %ile). Cost: $800k."`. Use templates or LLM with structured prompt. | Replace heuristics with metrics-driven summaries. Optionally: Use OpenAI API with cached system prompt: `"You are an urban planner. Explain why site {lat, lng} was selected based on: population={pop}, travel_time={time}, hazard={risk}."`. Cache responses per scenario hash. |
| Absence of facility registry | Cannot consider existing hospitals/schools | **FacilityRegistryService (new)** ingesting OSM/official datasets | `GET /api/facilities?type=hospital&bounds={north,south,east,west}` returns `[{id, lat, lng, name, type, capacity, utilization, status}, ...]`. Ingest via Overpass API: `POST https://overpass-api.de/api/interpreter` with query `[out:json]; node["amenity"="hospital"]({bbox}); out;`. Store in Postgres: table `facilities` with columns `id, geom (PostGIS Point), name, type, capacity, metadata (JSONB)`. | Update OSM data weekly. Allow manual edits via admin UI. Capacity: default 100 beds (hospitals), 500 students (schools) if OSM tag missing. Compute utilization: `demand_in_catchment / capacity`. Expose via REST API consumed by optimization service. |
| Lack of demand modeling | Population treated uniformly | **DemandService (new)** built on PRD1 layers | `GET /api/demand?aoi={...}&type=hospital` returns demand grid: `[{cellId, lat, lng, population, need, vulnerability, demandScore}, ...]`. Aggregate WorldPop by age: elderly (65+) for hospitals, children (5-17) for schools. Multiply by vulnerability (INFORM Risk index, 0–1 scale). Formula: `demand[cell] = pop[cell] × age_weight[cell] × (1 + vulnerability[cell])`. | Store preprocessed grids (500m resolution) in PostGIS. Update annually when WorldPop releases new data. Expose zonal stats via API. Example: Hospital demand = `sum(pop_65plus) × 1.5` (elderly weight 1.5×). |

## 7. Data Inputs & Integrations
- Demand grid from PRD1 (WorldPop, INFORM, hazard overlays).
- Travel-time matrices from PRD2 (OSRM-based).
- Facility data: OSM (via Overpass API `https://overpass-api.de/api/interpreter`), Ministry of Health/Education registries, HDX datasets.
- Hazard masks (flood, heat) to constrain candidate sites.

## 8. API Sketch & Examples

### Optimization Request
```json
POST /api/optimize
{
  "aoi": {
    "north": 43.5, "south": 43.0,
    "east": 77.0, "west": 76.5
  },
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

### Response
```json
{
  "scenarioId": "abc123",
  "selectedSites": [
    {
      "siteId": 1,
      "lat": 43.22,
      "lng": 76.85,
      "priority": "high",
      "populationServed": 12000,
      "vulnerableServed": 3000,
      "avgTravelTime": 18,
      "maxTravelTime": 35,
      "cost": 800000,
      "reason": "Serves 12k people (incl 3k elderly) within 20 min. Low flood risk (10th percentile)."
    },
    ...
  ],
  "metrics": {
    "totalCost": 4500000,
    "avgTravelTime": 22,
    "maxTravelTime": 42,
    "coverageVulnerable": 0.85,
    "coverageGeneral": 0.92,
    "giniAccess": 0.28
  },
  "provenance": {
    "demandSource": "WorldPop 2020",
    "travelTimeSource": "OSRM + HERE congestion",
    "hazardSource": "Global Flood DB 2021"
  }
}
```

## 9. Optimization Implementation Details

### Problem Formulation (P-Median Example)
**Decision variables**:
- `x[s]`: Binary, 1 if we build facility at site `s`
- `y[p,s]`: Fraction of demand cell `p` served by site `s`

**Objective**:
```
minimize: sum_{p,s} demand[p] × travel_time[p,s] × y[p,s]
```

**Constraints**:
1. Budget: `sum_s cost[s] × x[s] ≤ budget`
2. Max sites: `sum_s x[s] ≤ K`
3. Assignment: `sum_s y[p,s] = 1` for all `p` (everyone assigned)
4. Linking: `y[p,s] ≤ x[s]` (can't assign to non-built site)
5. Environmental: `x[s] = 0` if `flood_risk[s] > threshold`
6. Travel time: `y[p,s] = 0` if `travel_time[p,s] > max_time`

### OR-Tools Code Skeleton
```python
from ortools.sat.python import cp_model

model = cp_model.CpModel()

# Variables
x = {s: model.NewBoolVar(f'x_{s}') for s in candidate_sites}
y = {(p, s): model.NewBoolVar(f'y_{p}_{s}') 
     for p in demand_cells for s in candidate_sites}

# Objective
model.Minimize(
    sum(demand[p] * travel_time[p][s] * y[(p, s)]
        for p in demand_cells for s in candidate_sites)
)

# Constraints
model.Add(sum(cost[s] * x[s] for s in candidate_sites) <= budget)
model.Add(sum(x[s] for s in candidate_sites) <= max_facilities)

for p in demand_cells:
    model.Add(sum(y[(p, s)] for s in candidate_sites) == 1)

for p in demand_cells:
    for s in candidate_sites:
        model.Add(y[(p, s)] <= x[s])

# Solve
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 60.0
status = solver.Solve(model)

if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
    selected = [s for s in candidate_sites if solver.Value(x[s]) == 1]
```

### Equity Objective (P-Center, Maxmin)
Replace objective with:
```python
z = model.NewIntVar(0, 3600, 'max_travel_time')  # seconds
for p in demand_cells:
    assigned_time = sum(travel_time[p][s] * y[(p, s)] for s in candidate_sites)
    model.Add(assigned_time <= z)
model.Minimize(z)
```

## 10. Success Metrics
- Solver completes ≤60 s for 200 candidate sites × 500 demand cells.
- Optimization improves avg travel time ≥20% over heuristic baseline in benchmark scenario.
- Each scenario output contains equity metrics and capacity utilization summaries.

## 11. Timeline & Resources
- Requires PRDs 1 & 2. Estimated 8–10 weeks (1 backend + 1 data/optimization engineer).
- Milestones: (1) Demand + facility services, (2) OR-Tools MVP, (3) Equity metrics + scenario persistence.

## 12. Risks & Mitigations
- **Solver scalability** → Pre-cluster candidates, use greedy warm starts, or fallback heuristics for >1k sites.
- **Data gaps (capacity)** → Allow manual overrides, include confidence scores, document assumptions.
- **Explainability** → Persist intermediate metrics (marginal gain per site) for UI narratives.
