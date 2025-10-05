# PRD 5 — Robustness, Equity Analytics & Research Extensions

## 1. Overview
Provide advanced analytics—scenario stress tests, climate-adjusted planning, and research sandboxes—needed by municipal strategists and academic partners to trust long-term recommendations.

## 2. Problem Statement
Single-scenario outputs ignore uncertainty (population growth, climate change, demand shocks). Without robustness metrics (regret, worst-case, sensitivity) and scenario tooling, the platform cannot support strategic plans or academic collaborations (e.g., MBZUAI research).

## 3. Target Users
- Research teams evaluating fairness and robustness of allocation policies.
- Municipal strategists planning staged deployments over a decade.
- NGOs assessing resilience of interventions under extreme events.

## 4. Objectives
1. Run multi-scenario stress tests automatically and visualize robustness metrics per site/scenario.
2. Incorporate climate projections and demand shocks into hazard/demand layers.
3. Offer experimental tooling (robust optimization, reinforcement learning prototypes) for research extensions.

## 5. Functional Requirements
- **Scenario generator**: Library of predefined futures (population +20%, heatwave frequency +50%, major bridge outage, epidemic demand spike) configurable via UI/CLI.
- **Batch optimization runner**: Execute optimization jobs across scenarios; persist outputs, compute regret vs. scenario-optimal baseline.
- **Robustness dashboards**: Heatmaps showing per-site performance across scenarios, worst-case metrics, sensitivity bars.
- **Climate-adjusted layers**: Integrate CMIP6 downscaled temperature/precipitation (2030/2050) and recompute hazard layers (heat, flood trends).
- **Multi-period planning**: Allow staged investments (Year 0/5/10 budgets) with intertemporal constraints.
- **Research sandbox APIs**: Expose anonymized benchmark datasets + solver hooks for experimentation (RL, heuristics, robust optimization).

## 6. Service Replacement Mapping & Implementation Details
| Current Capability | Limitation | Upgrade / Service | API Endpoint & Implementation | Implementation Notes |
|--------------------|------------|-------------------|-------------------------------|----------------------|
| Single-run optimization | No uncertainty handling | **ScenarioBatchService** orchestrating multi-scenario runs + regret metrics | `POST /api/batch-optimize` with `{ "baseScenario": {...}, "variants": [{ "name": "pop_growth", "adjustments": { "populationMultiplier": 1.2 } }, ...] }`. Returns `{ "baseResults": {...}, "variantResults": [{name, results, regret}, ...], "robustnessMetrics": {...} }`. Use job queue (BullMQ: `npm install bullmq`) + worker pool. Worker: Calls `/api/optimize` per scenario, computes regret: `(optimal_cost - actual_cost) / optimal_cost`. | **BullMQ setup**: Redis for queue, workers in separate processes. Store job status in `batch_jobs` table. Expose progress via WebSocket or polling endpoint `GET /api/batch-jobs/{id}/status`. Regret baseline: Solve each scenario optimally (single-scenario planner), compare to robust solution (fixed sites across scenarios). |
| Static climate layers | No future projections | Integrate **CMIP6 downscaled** datasets via CDS/ESGF, derive delta layers | **CMIP6 Data**: Download via Copernicus CDS API (`c.retrieve('projections-cmip6', {...})`) or ESGF (https://esgf-node.llnl.gov/). Select models: CESM2, MRI-ESM2-0 (high resolution). Variables: tas (temperature), pr (precipitation). Scenarios: SSP2-4.5, SSP5-8.5. Downscale via bias-correction (e.g., quantile mapping) or use pre-downscaled datasets (NASA NEX-GDDP-CMIP6). Compute delta layers: `future_temp = baseline_temp + (cmip6_2050_temp - cmip6_historical_temp)`. Store as separate rasters (2030, 2050). | Blend with existing rasters for future hazard maps. Example: Recompute heat stress indices (WBGT) for 2050 using CMIP6 temp + humidity. Update flood risk layers using CMIP6 precipitation anomalies + hydrological models (GFMS, CaMa-Flood). **Storage**: S3/COG with time dimension. **API**: `GET /api/data/temperature?year=2050` returns future layer. |
| No research hooks | Difficult to collaborate with universities | **ResearchSandbox API** exposing datasets + baseline solvers | `GET /api/research/datasets` returns list: `[{ "name": "almaty_demand_grid", "url": "/api/research/datasets/almaty_demand_grid.geojson", "description": "500m demand grid with age stratification" }, ...]`. `POST /api/research/solve` accepts custom solver: `{ "algorithm": "rl", "config": {...}, "data": {...} }`. Returns metrics for benchmarking. Expose baseline OR-Tools solver for comparison. | Include documentation + example notebooks (Jupyter). Anonymize datasets: Remove identifying info (street names, personal data). Provide Docker image with preloaded data + solvers for reproducibility. Use API keys for access control. Host on separate subdomain (e.g., research.wcity.io). |

## 7. Climate Data Integration

### CMIP6 Downscaled Projections
**Data Sources**:
- **NASA NEX-GDDP-CMIP6**: Bias-corrected, spatially downscaled (0.25°, ~25km) climate projections (2015-2100). Access: AWS S3 `s3://nex-gddp-cmip6/` or Google Cloud Storage.
- **CORDEX**: Regional climate models for specific regions (e.g., Central Asia). Higher resolution (~12-50km). Access: ESGF nodes.
- **WorldClim Future**: Bioclimatic variables (2040-2060, 2060-2080) at 1km resolution. Access: https://worldclim.org/data/cmip6/cmip6_clim1km.html

**Variables**:
- `tas`: Near-surface air temperature (K).
- `pr`: Precipitation (kg m⁻² s⁻¹).
- `tasmax`, `tasmin`: Daily max/min temperature.

**Scenarios**:
- SSP2-4.5: Moderate emissions (Paris Agreement compliant).
- SSP5-8.5: High emissions (business-as-usual).

**Processing Pipeline**:
1. Download NetCDF files for Central Asia AOI (lon: 50-90, lat: 35-55).
2. Compute anomalies: `delta_temp = mean(cmip6_2050) - mean(cmip6_historical)`.
3. Add to baseline: `future_LST = modis_LST + delta_temp`.
4. Recompute hazard indices:
   - Heat stress: WBGT from temperature + humidity.
   - Drought: SPEI from precipitation + temperature.
   - Flood: Use increased precipitation as input to GFMS.
5. Store as time-sliced COG: `temperature_2030.tif`, `temperature_2050.tif`.

**API Example**:
```bash
GET /api/data/temperature?lat=43.22&lng=76.85&year=2050
# Returns: { "value": 35.2, "unit": "°C", "source": "MODIS baseline + CMIP6 SSP2-4.5 delta", "confidence": "medium" }
```

### Scenario Generator Library
**Predefined Scenarios**:
| Scenario Name | Adjustments | Description |
|---------------|-------------|-------------|
| `population_growth` | `populationMultiplier: 1.2` | +20% population by 2030 (WorldPop projections). |
| `climate_moderate` | `temperatureDelta: +2°C`, `precipitationDelta: +10%` | SSP2-4.5 scenario. |
| `climate_severe` | `temperatureDelta: +4°C`, `precipitationDelta: +20%` | SSP5-8.5 scenario. |
| `epidemic` | `demandMultiplier: { hospital: 3.0 }` | 3x hospital demand (pandemic surge). |
| `bridge_outage` | `disableLinks: ["bridge_12"]` | Major bridge closed; travel times increase. |
| `heatwave` | `heatDaysMultiplier: 1.5` | 50% more heat stress days. |

**Configuration Format** (YAML or JSON):
```yaml
name: population_growth
adjustments:
  populationMultiplier: 1.2
  demandLayers:
    - layer: worldpop_total
      operation: multiply
      value: 1.2
```

**Backend Implementation**:
- Load base scenario config.
- Apply adjustments: `adjusted_demand = base_demand * populationMultiplier`.
- Run optimization with adjusted inputs.
- Store results with scenario tag.

## 8. Robustness Metrics & Visualization

### Regret Metric
**Definition**: Performance gap vs. optimal solution given perfect foresight.
```
regret(solution, scenario) = (optimal_score[scenario] - solution_score[scenario]) / optimal_score[scenario]
```

**Example**:
- Scenario A: Optimal avg travel time = 20 min. Robust solution achieves 22 min. Regret = (22-20)/20 = 10%.
- Scenario B: Optimal = 25 min. Robust solution = 30 min. Regret = 20%.
- **Worst-case regret**: max(10%, 20%) = 20%.

### Visualization
**Heatmap**:
- Rows: Sites (1-10).
- Columns: Scenarios (baseline, pop_growth, climate_moderate, ...).
- Cell color: Performance metric (e.g., population served). Green = good, red = bad.
- Tooltip: "Site #3 serves 10k people in baseline, 8k in climate_severe (-20%)."

**Sensitivity Bar Chart**:
- X-axis: Sites.
- Y-axis: Std deviation of performance across scenarios.
- High std = sensitive site; low std = robust site.

**Worst-Case Panel**:
- Card: "Worst-case scenario: climate_severe. Max travel time: 50 min (vs. 30 min baseline)."

## 9. Multi-Period Planning

### Formulation
**Decision variables**:
- `x[s,t]`: Binary, 1 if we build facility at site `s` in period `t` (t = 0, 5, 10 years).
- `y[p,s,t]`: Fraction of demand cell `p` served by site `s` in period `t`.

**Objective**:
```
minimize: sum_t discount[t] × sum_{p,s} demand[p,t] × travel_time[p,s] × y[p,s,t]
```

**Constraints**:
- Budget per period: `sum_s cost[s] × x[s,t] ≤ budget[t]`.
- Cannot un-build: `x[s,t] ≥ x[s,t-1]`.
- Demand evolves: `demand[p,t] = demand[p,0] × (1 + growth_rate)^t`.

**API Endpoint**:
```json
POST /api/optimize-multiperiod
{
  "periods": [
    { "year": 0, "budget": 5000000 },
    { "year": 5, "budget": 3000000 },
    { "year": 10, "budget": 2000000 }
  ],
  "growthRate": 0.02,
  "discountRate": 0.05,
  ...
}
```

## 10. Research Sandbox

### Exposed Datasets
| Dataset | Format | URL | Description |
|---------|--------|-----|-------------|
| Demand Grid | GeoJSON | `/api/research/datasets/demand_grid.geojson` | 500m cells with population, need, vulnerability. |
| Travel Time Matrix | CSV | `/api/research/datasets/travel_matrix.csv` | N×M matrix (origins × destinations, seconds). |
| Facility Registry | GeoJSON | `/api/research/datasets/facilities.geojson` | Existing hospitals/schools with capacity. |
| Hazard Layers | GeoTIFF | `/api/research/datasets/flood_risk.tif` | Flood, heat, air quality rasters. |
| Benchmark Solutions | JSON | `/api/research/datasets/benchmark_solutions.json` | OR-Tools optimal solutions for test cases. |

### Solver Hook API
```json
POST /api/research/solve
{
  "algorithm": "custom",
  "config": { "method": "rl", "episodes": 1000 },
  "data": {
    "demandGrid": "...",
    "travelMatrix": "...",
    "budget": 5000000,
    "maxFacilities": 5
  }
}
```

**Response**:
```json
{
  "selectedSites": [1, 5, 12, 18, 23],
  "metrics": {
    "avgTravelTime": 24.5,
    "maxTravelTime": 48,
    "cost": 4800000
  },
  "runtime": 120.5
}
```

**Baseline Comparison**:
- System runs OR-Tools baseline for same inputs.
- Returns: `{ "custom": {...}, "ortools": {...}, "improvement": "+5% coverage" }`.

### Example Notebooks
- **Jupyter Notebook 1**: "Load Almaty demand grid, run OR-Tools, visualize isochrones."
- **Jupyter Notebook 2**: "Train RL agent for sequential site selection."
- **Jupyter Notebook 3**: "Compute equity metrics (Gini, maxmin) for benchmark solutions."

**Distribution**: Host on GitHub repo with Docker setup:
```bash
docker run -p 8888:8888 wcity/research-sandbox
# Opens Jupyter at localhost:8888 with preloaded data
```

## 11. Success Metrics
- Ability to evaluate ≥5 scenarios per plan and surface sites robust in ≥80% of futures.
- Export-ready robustness report (charts, metrics) auto-generated for at least one pilot partner.
- At least one research partner (e.g., MBZUAI) runs experiments via sandbox API.

## 12. Timeline & Resources
- Requires PRDs 1–4. Estimated 6–12 months with 2 engineers + 1 researcher.
- Milestones: (1) Scenario generator + batch runner, (2) climate-adjusted layers, (3) robustness dashboards + research sandbox.

## 13. Risks & Mitigations
- **Computation cost** → Use queue-based batch jobs, allow downsampling for exploratory runs.
- **Climate data volume** → Clip to AOIs, store as deltas vs. baseline to reduce size.
- **RL/advanced methods uncertainty** → Keep traditional OR-Tools baseline as fallback; treat RL as experimental feature flag.
