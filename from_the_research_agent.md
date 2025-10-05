# Critical Analysis & Upgrade Path for Urban Infrastructure Planning System

## Initial Clarifications & Assumptions

Before proceeding, I'm assuming:
- Your primary deployment region is Central Asia (Almaty as reference), but you want the system to be generalizable
- You have moderate cloud compute budget (can handle API calls, some preprocessing, but not massive GIS operations)
- Target users are urban planners, NGOs, local government officials (not just researchers)
- "6-18 months" means ~2-3 engineers + your research time

If these assumptions are wrong, let me know and I'll adjust.

---

## Short Critique of Current System

**What's good:**
- Strong conceptual foundation: multi-hazard + accessibility is the right framing
- Modular architecture (Vue frontend, NestJS backend, separate scoring/planning services)
- Focus on usability over pure algorithmic benchmarking is refreshing and correct
- Map-based interaction with point-click suitability is intuitive

**Critical gaps:**
1. **Mock data undermines credibility**: Without real environmental layers, you can't validate decisions or publish results. Heuristic NDVI/LST/AOD will never match ground truth patterns.
2. **No network model = no real accessibility**: Population density alone doesn't capture *reachability*. A dense neighborhood blocked by a river or highway becomes invisible.
3. **Suitability ≠ allocation**: Current scoring is good for environmental analysis but doesn't answer "where should we put 5 new clinics given $2M budget and existing facilities?"
4. **No demand modeling**: You don't know *who needs what* (elderly near hospitals, children near schools, vulnerable populations near shelters).
5. **No validation framework**: Without baselines, equity metrics, or robustness tests, it's a proof-of-concept, not a decision-support tool.

**Bottom line**: You have a good environmental risk viewer, but you need to evolve it into an *optimization-driven allocation engine* with real data and network-aware access modeling.

---

## 1. Data Realism and Coverage

### Temperature / Heat Stress
**Current state**: Latitude-based estimates  
**Upgrade to**:
- **MODIS Land Surface Temperature (LST)**: 
  - Source: NASA LANCE/MODIS MOD11A1 (daily, 1km) via AppEEARS or direct HTTPS
  - Access: Tile-based download or STAC API (Earth Search) for AOI
  - Resolution: 1km daily, ~8-day composites for cloud-free
  - Integration: Pre-tile for viewport regions (e.g., 100km² grids), cache in PostGIS with timestamps
  
- **ERA5-Land reanalysis** (Copernicus):
  - 2m air temperature, hourly, 9km native resolution
  - Access: CDS API (free registration), download NetCDF for AOI + date range
  - Better for historical trends, MODIS better for spatial detail
  
- **Heat stress indices**: Compute Wet Bulb Globe Temperature (WBGT) or Heat Index from temperature + humidity (ERA5 has both)

**Why these**: MODIS is standard for urban heat island studies. ERA5 fills gaps during cloudy periods and provides multi-decadal climatology.

**Pipeline**: 
- Preprocessing: Download monthly composites for Almaty region, convert to Cloud-Optimized GeoTIFF (COG), serve via TiTiler or MapServer WMS
- Query mode: For point queries, use rasterio to extract pixel values; for planning, pre-aggregate to 500m or 1km grid cells

---

### Water / Soil Moisture / Drought / Flood Risk
**Current state**: Latitude + season heuristic  

**Upgrade to**:
- **SMAP Soil Moisture** (NASA):
  - L3 daily, 9km resolution
  - Access: NASA Earthdata via HTTPS or AppEEARS
  - Integration: Same as MODIS—tile and cache, query by lat/lng
  
- **GLDAS-2.1** (NASA):
  - Soil moisture, runoff, evapotranspiration, 0.25° (~27km), 3-hourly
  - Access: GES DISC via OPeNDAP or bulk download
  - Better temporal coverage than SMAP (2000-present vs. 2015-present)
  
- **Flood hazard**:
  - **Global Flood Database** (Cloud to Street + Google): Historical flood extents, Sentinel-1 based
  - **GFMS Real-time Flood Monitoring** (NASA): Rainfall-runoff model, global, 1km, updated every 3 hours
  - **JRC Global Surface Water**: Long-term water presence (1984-2021), 30m
  
- **Drought indices**:
  - Compute SPI (Standardized Precipitation Index) or SPEI from ERA5 precipitation + temperature
  - Or use pre-computed indices from IRI Data Library

**Why these**: SMAP is gold standard for soil moisture validation. Flood databases give you historical risk zones. GLDAS fills temporal gaps.

**Pipeline**:
- Pre-process flood risk as static raster layer (return periods: 10yr, 50yr, 100yr zones)
- Dynamic soil moisture: Update weekly or monthly, cache as raster tiles
- Drought: Compute monthly indices, display as time series + current anomaly

---

### Air Pollution / Aerosols
**Current state**: Estimated from climate zones  

**Upgrade to**:
- **MODIS AOD (Aerosol Optical Depth)**:
  - MOD04 daily, 10km, from LANCE
  - Proxy for PM2.5/PM10 (requires calibration with ground stations)
  
- **Copernicus Atmosphere Monitoring Service (CAMS)**:
  - **Best option**: Global reanalysis of PM2.5, PM10, NO2, O3, CO
  - Resolution: 0.4° (~44km), but higher resolution for Europe (0.1°)
  - Access: CDS API, download NetCDF
  - Updated daily with forecasts
  
- **OpenAQ**:
  - Ground station data (if available in Almaty)
  - REST API, free, real-time + historical
  - Use to calibrate CAMS/MODIS
  
- **Sentinel-5P TROPOMI**:
  - NO2, SO2, CO at 5.5km resolution (better than MODIS for trace gases)
  - Access: Copernicus Data Space or Google Earth Engine

**Why these**: CAMS provides validated, multi-pollutant fields. OpenAQ gives you ground truth for calibration. TROPOMI adds high-res trace gas detail.

**Pipeline**:
- Preprocessing: Download CAMS monthly averages, convert to COG, serve via WMS
- Point queries: Interpolate from nearest grid cell
- Real-time: Poll OpenAQ daily for Almaty stations, display alongside model data
- **Calibration layer**: If you have 6-12 months of OpenAQ + CAMS pairs, train a simple bias-correction model (linear regression or light GBM) to adjust CAMS predictions

---

### Vegetation and Land Cover
**Current state**: Estimated NDVI  

**Upgrade to**:
- **MODIS NDVI**:
  - MOD13Q1 16-day composite, 250m resolution
  - Access: AppEEARS or LANCE
  - Standard for vegetation monitoring
  
- **Sentinel-2 MSI**:
  - 10m resolution, 5-day revisit (Europe) to 10-day (Central Asia)
  - Access: Copernicus Data Space, AWS Open Data, or Google Earth Engine
  - Compute NDVI from B4 (red) and B8 (NIR)
  - **Much better for urban areas** (can distinguish parks, street trees)
  
- **Land cover**:
  - **ESA WorldCover**: 10m global land cover (11 classes), 2020/2021, free
  - **Dynamic World** (Google): 10m, near-real-time land cover, 9 classes
  - **Copernicus CORINE** (Europe only, but high quality, 100m, 44 classes)
  
- **Urban tree canopy**:
  - Compute from Sentinel-2 NDVI + land cover mask
  - Or use city-specific LiDAR if available (e.g., Almaty municipality)

**Why these**: Sentinel-2 at 10m is transformative for urban analysis. ESA WorldCover is free and globally consistent.

**Pipeline**:
- MODIS NDVI: Download quarterly composites, cache as COG
- Sentinel-2: Either pre-process NDVI for Almaty (download 1 year of scenes, cloud-mask with s2cloudless, mosaic) OR use Google Earth Engine API to serve on-demand
- Land cover: Download ESA WorldCover for Central Asia, rasterize into your database, use for masking (e.g., "avoid placing hospitals in forests")

---

### Population Density, Deprivation, and Vulnerability
**Current state**: SEDAC-like model with randomness  

**Upgrade to**:
- **WorldPop**:
  - 100m resolution population density (2000-2020), constrained to settlements
  - Age-stratified (0-1, 1-4, 5-9, ... 80+) and sex-disaggregated
  - Access: FTP download (raster) or Google Earth Engine
  - **Best free population dataset**
  
- **GHSL (Global Human Settlement Layer)**:
  - Built-up area, population density (1975-2030 projections), 100m/1km
  - Settlement typology (urban centers, clusters, rural)
  - Access: Direct download from JRC
  
- **Deprivation / vulnerability**:
  - **CIESIN SEDAC Poverty Mapping**: GDP per capita, subnational poverty rates
  - **DHS / MICS surveys**: Where available (e.g., some Central Asian countries), gives granular health/education indicators
  - **INFORM Subnational Risk Index**: Combines hazard exposure, vulnerability, lack of coping capacity; 10km grid
  - **City-level open data**: Almaty municipality may have block-level socioeconomic data (income, education, informality); check their open data portal
  
- **Informal settlements**:
  - No perfect global dataset, but you can proxy:
    - High population density + low GHSL built-up quality
    - Low VIIRS nighttime lights relative to population (indicates lack of infrastructure)
    - Manual digitization from high-res imagery (Planet, Maxar) if budget allows

**Why these**: WorldPop is validation-grade. GHSL adds temporal depth. INFORM gives you a ready-made vulnerability index.

**Pipeline**:
- Download WorldPop 100m rasters for Kazakhstan, load into PostGIS raster or convert to vector (zonal stats per 500m grid)
- Preprocessing: Aggregate to census block or 500m grid cells with population by age group
- Deprivation: Join INFORM risk scores or city admin data by zone
- **Demand modeling**: Use age-stratified population (kids → schools, elderly → clinics, informal settlements → shelters)

---

### Summary Table: Priority Data Upgrades

| Domain | Top Source | Resolution | Access | Priority |
|--------|-----------|-----------|--------|----------|
| Temperature | MODIS LST + ERA5-Land | 1km / 9km | AppEEARS / CDS API | High |
| Soil Moisture | SMAP L3 | 9km | Earthdata | Medium |
| Flood Risk | Global Flood Database | 30m | Google Cloud | High |
| Air Quality | CAMS + OpenAQ | 44km + stations | CDS + REST API | High |
| Vegetation | Sentinel-2 NDVI | 10m | Copernicus | High |
| Land Cover | ESA WorldCover | 10m | Direct DL | High |
| Population | WorldPop + GHSL | 100m | FTP / GEE | Critical |
| Vulnerability | INFORM Risk | 10km | Direct DL | Medium |

---

## 2. Mobility and Congestion Modeling

**Goal**: Replace "distance to point" with "travel time via actual road network, accounting for congestion."

### Road Network and Basic Travel Time

**Core engine**:
- **OpenStreetMap (OSM)** for road graph:
  - Download via Overpass API or Geofabrik extracts (e.g., `kazakhstan-latest.osm.pbf`)
  - Parse with osmium or pyrosm into GeoDataFrame (roads with speed limits, road types)
  
- **Routing engine**:
  - **OSRM (Open Source Routing Machine)**: Fast, free, supports car/bike/walk profiles
    - Self-host: Docker container, load Kazakhstan OSM extract, ~2-4GB RAM
    - Provides isochrones (reachable areas in X minutes) and route matrices (NxN travel times)
  - **OpenRouteService**: Similar to OSRM, slightly more features (wheelchair accessibility, elevation), free tier API or self-hosted
  - **Valhalla**: More complex, better for multi-modal, but heavier setup
  
**Recommendation**: Start with **OSRM self-hosted**. It's fast enough for real-time queries (< 100ms for point-to-point, ~1-2s for large matrices).

**Pipeline**:
1. Preprocess OSM: Download Almaty/Kazakhstan extract, build OSRM graph (~5 min on laptop)
2. Deploy OSRM container alongside your NestJS backend
3. Expose endpoints:
   - `/route` for single routes (user clicks A→B)
   - `/table` for distance matrices (N candidate sites × M population centers)
   - `/isochrone` for catchment areas (all areas within 15 min of a hospital)

**Integration**:
- **Point-to-point**: User clicks a site → show 10/20/30 min isochrones on map
- **Planning mode**: For each candidate site in viewport, query travel time to 100-500 population centroids → compute average access time

---

### Congestion Data

**Challenges**: Real-time traffic is proprietary (Google, HERE, TomTom) and expensive.

**Practical options**:
1. **HERE Traffic API** (freemium):
   - 250k transactions/month free tier
   - Provides speed factors (current vs. free-flow) per road segment
   - Use to adjust OSRM speeds during peak hours
   - **Best for proof-of-concept**

2. **City open data**:
   - Some cities publish historical speed/volume (e.g., NYC Taxi data, London TfL)
   - Check if Almaty or regional government has traffic sensor data
   - Often in weird formats (CSV, Shapefiles), requires cleaning

3. **Proxy from OSM + population**:
   - For roads with no data, estimate peak-hour slowdown:
     - Arterials in high-density areas: 0.5x speed
     - Residential: 0.8x speed
   - Crude but better than nothing

4. **Uber Movement** (archived):
   - Historical travel times for ~20 cities (2016-2020)
   - No longer updated, but useful for calibration if Almaty is included

**Recommendation**: 
- Phase 1: Use free-flow OSRM speeds (no congestion)
- Phase 2: Integrate HERE API for peak-hour adjustment, OR use manual slowdown factors for major corridors you know are congested
- Long-term: Partner with local government/telcos for probe data

**Modeling approach**:
- Store "time-of-day" multipliers: OSRM base speed × `congestion_factor(hour, road_type, zone)`
- For planning, use **average daily conditions** (weighted by travel demand profile—more trips at 8am, 6pm)

---

### Multimodal Access

**Why**: Not everyone drives. Low-income groups rely on transit.

**Options**:
1. **Walking**: OSRM pedestrian profile (~5 km/h), already supported
2. **Public transit**:
   - **GTFS feeds**: If Almaty has public transit open data, parse GTFS (routes, stops, schedules)
   - Tools: `gtfs-realtime-bindings` (Python), `r5py` (transit routing)
   - Compute transit isochrones (requires R5 or OpenTripPlanner, heavier setup)
   - **Reality check**: GTFS may not exist for Almaty; if not, this is Phase 3
3. **Cycling**: OSRM bike profile, useful in flat cities

**Minimum viable product**:
- Compute access for **walking (5 km/h)** and **driving (OSRM car)**
- Show both on map (e.g., "70% of population within 30-min drive, 40% within 30-min walk")
- Transit is nice-to-have unless you have GTFS

---

### Integration Example: Accessibility-Weighted Demand

Instead of "population density," compute **access-weighted demand**:

```
demand_at_site_s = sum over population cells p:
    population[p] × need_factor[p] × decay(travel_time[p → s])
```

Where:
- `need_factor[p]`: Higher for vulnerable groups (elderly, low-income)
- `decay()`: Travel time penalty, e.g., `1 / (1 + travel_time/30min)²`

This gives you a single metric: "This site would serve X effective people given realistic travel barriers."

---

## 3. Demand, Capacity, and Equity

**Current gap**: You score sites environmentally, but don't model *who needs service* or *how much service exists already*.

### Demand Modeling

**Population by need**:
- **Health**: Elderly (65+), children (<5 for clinics), chronic illness prevalence (use DHS/MICS or WHO estimates)
- **Education**: School-age (5-17), further stratified by primary/secondary if possible
- **Shelters**: Total population in high-risk zones (flood, earthquake, heat), weight by informality/poverty

**Data sources**:
- WorldPop age/sex rasters → aggregate to grid cells or admin zones
- INFORM risk → multiply population by vulnerability score
- City data: School enrollment, clinic visit rates if available

**Demand formula**:
```
demand[zone i] = population[i] × need_rate[i] × (1 + vulnerability[i])
```

Example: A zone with 10k people, 15% elderly, and high flood risk → demand for clinics = `10k × 0.15 × 1.3 = 1,950 equivalent people`.

---

### Capacity of Existing Facilities

**Critical input**: Without knowing where existing hospitals/schools are, you can't optimize.

**Data sources**:
1. **OpenStreetMap**:
   - Tags: `amenity=hospital`, `amenity=school`, etc.
   - Download with Overpass API, parse into GeoDataFrame
   - **Problem**: OSM completeness varies (urban areas OK, rural poor)
   
2. **Government registries**:
   - Kazakhstan Ministry of Health/Education should have facility lists
   - May require scraping or FOIA request
   
3. **Humanitarian datasets**:
   - HDX (Humanitarian Data Exchange): Health/education facility points for some countries
   - Global Database of Health Facilities (not perfect, but exists)

**Capacity attributes**:
- Hospitals: Number of beds, specialties, staff (if available)
- Schools: Enrollment capacity
- Shelters: None yet → you're planning for new ones

**Modeling**:
- For each existing facility `f`, compute its **catchment population**: Sum of population within 30-min travel time (via OSRM isochrone)
- Compute **utilization**: `demand_in_catchment / capacity`
- Identify **underserved areas**: Zones where nearest facility is >30 min away OR utilization >100%

---

### Equity Metrics

**Problem**: Minimizing *average* travel time can ignore the worst-off.

**Equity metrics to track**:

1. **Maxmin (Rawlsian)**:
   - Minimize the maximum travel time for any population cell
   - Or maximize minimum access (worst-served zone)
   - Formula: `min_{s in new sites} max_{p in population} travel_time[p → nearest facility]`

2. **Coverage gap by vulnerability**:
   - % of vulnerable population (informal settlements, elderly, low-income) within 30 min of a facility
   - Compare to % of general population
   - Aim for no disparity

3. **Gini coefficient of access**:
   - Treat "access" as a resource (e.g., 1 / travel_time)
   - Compute Gini across all zones
   - Lower Gini = more equitable

4. **Spatial equity (geographic)**:
   - Ensure no region is systematically underserved
   - Compute per-district average travel time, flag outliers

**Implementation**:
- After optimization, compute all metrics for proposed solution vs. status quo
- Display as dashboard: "Current system: 30% of low-income residents >45 min from hospital. Proposed: 12%."

---

### Robustness Metrics

**Why**: Your plan should work under future uncertainty (climate change, population growth, demand shocks).

**Scenarios to test**:
1. **Population growth**: +20% over 10 years (from WorldPop projections)
2. **Climate shift**: +2°C, more frequent heat waves (from CMIP6 downscaled projections)
3. **Demand shock**: Epidemic → 3x hospital demand, localized flood → surge shelter demand
4. **Infrastructure failure**: Major bridge closes, forcing longer detours

**Robustness metrics**:
1. **Regret**: Performance gap vs. oracle planner who knew the future
   - For each scenario, compute optimal solution given perfect foresight
   - Compare to your robust solution
   - Regret = (optimal_score - your_score) / optimal_score
   
2. **Worst-case performance**:
   - Across all scenarios, find the one where your plan performs worst
   - Report that as "guaranteed performance under uncertainty"

3. **Scenario coverage**:
   - % of scenarios where your plan achieves ≥90% of optimal
   - (Requires solving many optimization problems, computationally heavy)

**Practical approach**:
- Define 5-10 plausible scenarios (Phase 2-3)
- For each, re-run your allocation algorithm
- If solutions are wildly different, you have high sensitivity → need robust optimization
- If solutions are similar, you have natural robustness → just pick the average-best

---

## 4. Optimization / Policy Engine

**Current state**: Heuristic scoring + LLM text generation  
**Upgrade to**: Formal optimization with constraints

### Problem Formulation

**Basic Facility Location Problem (FLP)**:

**Decision variables**:
- `x[s]`: Binary, 1 if we build a facility at candidate site `s`
- `y[p,s]`: Fraction of population cell `p`'s demand served by facility `s`

**Objective** (example: minimize average access time):
```
minimize: sum over (p,s): demand[p] × travel_time[p,s] × y[p,s]
```

**Constraints**:
1. Budget: `sum over s: cost[s] × x[s] ≤ B`
2. Capacity: `sum over p: demand[p] × y[p,s] ≤ capacity[s] × x[s]` for all `s`
3. Assignment: `sum over s: y[p,s] = 1` for all `p` (everyone assigned)
4. Linking: `y[p,s] ≤ x[s]` (can't assign to a non-built facility)
5. Max sites: `sum over s: x[s] ≤ K`
6. Environmental: `risk[s] × x[s] ≤ threshold` (e.g., don't build in flood zones)

**Variants**:
- **p-median**: Minimize total access cost, fixed number of facilities
- **p-center**: Minimize maximum access time (maxmin equity)
- **Coverage**: Maximize population within X minutes
- **Capacitated FLP**: Like above, with capacity constraints
- **Multi-objective**: Trade off cost, equity, environmental risk

---

### Recommended Framework: Integer Programming

**Why**: FLP is a classic IP problem. Mature solvers exist, and you can express complex constraints.

**Library**: **Google OR-Tools** (Python)
- Free, open-source, fast
- Supports mixed-integer programming (MIP), constraint programming (CP), routing
- Great documentation, active community
- **OR-Tools CP-SAT solver**: State-of-art for discrete optimization

**Alternative**: **Pyomo** (if you want more flexibility in modeling, can use GLPK/CBC for free or Gurobi/CPLEX for speed)

**Example code structure** (pseudo-Python):
```python
from ortools.sat.python import cp_model

model = cp_model.CpModel()

# Variables
x = {s: model.NewBoolVar(f'x_{s}') for s in candidate_sites}
y = {(p,s): model.NewBoolVar(f'y_{p}_{s}') 
     for p in population_cells for s in candidate_sites}

# Objective: minimize weighted travel time
model.Minimize(
    sum(demand[p] * travel_time[p][s] * y[(p,s)] 
        for p in population_cells for s in candidate_sites)
)

# Constraints
# 1. Budget
model.Add(sum(cost[s] * x[s] for s in candidate_sites) <= budget)

# 2. Each cell assigned to exactly one site
for p in population_cells:
    model.Add(sum(y[(p,s)] for s in candidate_sites) == 1)

# 3. Can only assign to built sites
for p in population_cells:
    for s in candidate_sites:
        model.Add(y[(p,s)] <= x[s])

# 4. Max K sites
model.Add(sum(x[s] for s in candidate_sites) <= K)

# Solve
solver = cp_model.CpSolver()
status = solver.Solve(model)

if status == cp_model.OPTIMAL:
    selected_sites = [s for s in candidate_sites if solver.Value(x[s]) == 1]
```

**Scalability**:
- OR-Tools can handle ~1000 binary variables, ~10k constraints on a laptop in seconds
- For your use case: 100 candidate sites × 500 population cells → ~50k variables → feasible
- If larger, use heuristics (see below)

---

### Heuristic Alternatives (if IP is too slow)

**When**: If you have 10k+ candidate sites or real-time requirements

**Options**:
1. **Greedy heuristics**:
   - Iteratively select the site that maximally reduces total access cost
   - Fast (O(n²)), no optimality guarantee
   - Works well for submodular objectives (diminishing returns)

2. **Simulated annealing / genetic algorithms**:
   - Standard metaheuristics, easy to implement
   - Libraries: DEAP (Python), Optuna (hyperparameter tuning, adaptable)

3. **Graph-based algorithms**:
   - Model as network flow (population → facilities → service)
   - Use min-cost flow (NetworkX or OR-Tools) if capacities are divisible

4. **Reinforcement learning** (long-term):
   - Train a policy to select sites sequentially given state (current coverage, budget remaining)
   - More complex, but could learn from historical decisions
   - Libraries: RLlib (Ray), Stable-Baselines3

**Recommendation**: Start with **OR-Tools IP**. If too slow, implement a greedy baseline for comparison.

---

### Multi-Objective Optimization

**Why**: Planners care about multiple goals (cost, equity, environmental risk).

**Approaches**:
1. **Weighted sum**: `objective = w1×cost + w2×max_travel_time + w3×risk`
   - Simple, but weights are arbitrary
   - Let user adjust weights in UI → re-solve → show trade-offs

2. **Pareto optimization**:
   - Solve for multiple solutions on Pareto frontier
   - Show user: "These 5 plans are equally valid, depending on priorities"
   - Tools: `pymoo` (Python multi-objective optimization)

3. **Constrained optimization**:
   - Minimize cost, subject to: max_travel_time ≤ 30 min, risk ≤ threshold
   - Clearer for practitioners ("no one should be >30 min from a clinic")

**Recommendation**: Start with weighted sum (easy), add Pareto analysis in Phase 2.

---

### Specific Formulation Examples

**Example 1: Equitable Clinic Placement**
- **Objective**: Minimize maximum travel time to nearest clinic (p-center)
- **Constraints**:
  - Budget ≤ $5M
  - Max 10 new clinics
  - Each clinic in low flood-risk zone (risk ≤ 0.3)
  - At least 50% of low-income population within 20 min
- **Solver**: OR-Tools CP-SAT (good for minimax objectives)

**Example 2: School Capacity Expansion**
- **Objective**: Minimize unmet enrollment demand
- **Constraints**:
  - Budget ≤ $10M
  - Each school serves 500-1000 students
  - No student >45 min walk to school
  - Balance enrollment across districts (equity constraint)
- **Solver**: OR-Tools MIP

---

## 5. Product & UX-Level Functionality

**Goal**: Make this a tool planners *want* to use, not just a research demo.

### New User-Facing Capabilities

**Scenario Design & Comparison**:
- **UI**: "Create Scenario" button → modal:
  - Name scenario (e.g., "Budget Option A")
  - Set: budget, max sites, infrastructure type, equity weight
  - Select constraints (avoid flood zones, prioritize underserved districts)
- **Backend**: Run optimization, save results (selected sites + metrics)
- **Display**: Table comparing scenarios side-by-side:
  | Metric | Current | Scenario A | Scenario B |
  |--------|---------|------------|------------|
  | Avg travel time | 35 min | 22 min | 25 min |
  | Max travel time | 90 min | 45 min | 60 min |
  | Coverage (vulnerable) | 60% | 85% | 80% |
  | Cost | $0 | $5M | $3M |
- **Map**: Toggle between scenarios → show proposed sites + isochrones in different colors

**Save & Share**:
- Export scenario as:
  - **GeoJSON**: Sites + catchment polygons (import into QGIS)
  - **PDF report**: Auto-generated with maps, charts, summary text (use pdfkit or WeasyPrint)
  - **Share link**: Save to database, generate short URL → colleagues can view
- **Collaboration**: If multi-user, add comments on scenarios ("I like A but can we avoid site #3?")

**Uncertainty Visualization**:
- For each proposed site, show:
  - **Sensitivity bar**: How much does total access cost change if we exclude this site? (Marginal value)
  - **Robustness heatmap**: Performance across scenarios (color-coded: green = robust, red = risky)
- Example: "Site #7 performs well in all scenarios except climate+2°C, where flood risk increases"

---

### Improved AI Planning Panel

**Current state**: Prompts LLM or uses fallback heuristic  
**Upgrade**:

**Input Controls**:
- **Hazards**: Multi-select (flood, heat, air pollution, earthquake)
  - Each hazard has a threshold slider (e.g., "avoid areas with >80th percentile flood risk")
- **Infrastructure type**: Dropdown (hospitals, schools, shelters, fire stations)
  - Each type has associated demand model (elderly for hospitals, kids for schools)
- **Budget & constraints**:
  - Budget slider ($0-$50M)
  - Max new sites (1-20)
  - Required equity level: "Standard" vs. "High priority for vulnerable" (changes objective weights)
- **Existing facilities**: Toggle "Show existing hospitals" → loads from OSM/government data
- **Viewport-based or city-wide**: Radio button (analyze just visible area vs. entire city)

**Output Panel**:
- **Map layer**: Proposed sites (numbered pins, color-coded by priority)
- **Side panel** for each site:
  - **Metrics**: Estimated population served, avg/max travel time, environmental risk scores
  - **Justification** (LLM-generated or template):
    - "Site #3 recommended because: (1) Serves 12k people within 20 min, including 3k elderly. (2) Low flood risk (10th percentile). (3) Near major transit hub."
  - **Trade-offs**: "If we skip this site, 4k people lose access within 30 min."
- **Summary stats**:
  - Total cost, coverage improvement vs. status quo, equity score
  - Chart: Travel time distribution (before vs. after)

**Interactive refinement**:
- User clicks "Exclude site #3" → re-runs optimization with that site blacklisted → updates map
- "Add 2 more sites" → increases K, re-solves
- "Prioritize district X" → adds weight to demand in that region, re-solves

**Explainability**:
- Instead of opaque "AI says X," show: "Based on: population density (40% weight), travel time (30%), environmental risk (20%), equity (10%)"
- Let user adjust weights → re-solve → see how recommendations change

---

### Example Workflow

1. User pans map to Almaty city center
2. Clicks "AI Planning" → selects "Hospitals," sets budget $5M, max 5 sites, prioritizes vulnerable populations
3. Checks hazards: flood + heat
4. Clicks "Generate Plan"
5. Backend:
   - Loads WorldPop population (elderly)
   - Loads flood risk + heat stress layers
   - Computes travel time matrix (OSRM)
   - Runs OR-Tools optimization
   - Returns 5 sites ranked by priority
6. Frontend:
   - Shows sites on map with 20/40/60 min isochrones
   - Side panel explains each site
   - Summary: "This plan would reduce avg travel time from 38 min to 24 min, covering 95% of elderly within 30 min."
7. User saves scenario as "Option A," tweaks budget to $3M, generates "Option B," compares

---

## 6. Prioritized Roadmap

### Phase 1: High-Impact Foundations (3-4 months)

**Goal**: Replace mock data, add basic network model, demonstrate optimization

**Features**:
1. **Real environmental data**:
   - Integrate MODIS LST, Sentinel-2 NDVI, ESA WorldCover (download, tile, serve via WMS)
   - Add CAMS air quality (monthly averages)
   - Replace heuristics with actual pixel queries
   
2. **Population + demand**:
   - Download WorldPop 100m for Kazakhstan, aggregate to 500m grid
   - Add age stratification (elderly for clinics, kids for schools)
   - Load existing facilities from OSM (hospitals, schools)

3. **OSRM routing**:
   - Deploy OSRM Docker container with Almaty OSM extract
   - Add `/isochrone` and `/table` endpoints to backend
   - Compute travel time matrices for planning

4. **Basic optimization**:
   - Implement OR-Tools p-median solver (minimize avg travel time, fixed K sites, budget constraint)
   - Input: viewport bounds, infrastructure type, K, budget
   - Output: List of (lat, lng, priority, justification)

5. **UI improvements**:
   - Add scenario save/compare (store in Postgres, show side-by-side table)
   - Display isochrones on map for proposed sites
   - Export GeoJSON

**External APIs/Datasets**:
- MODIS (AppEEARS)
- Sentinel-2 (Copernicus or GEE)
- ESA WorldCover (direct download)
- CAMS (CDS API)
- WorldPop (FTP)
- OSM (Geofabrik)

**Risks**:
- OSRM setup: May need 8-16GB RAM for larger regions (solvable with cloud instance)
- Data preprocessing: ~1 week per dataset (download, tile, QA)
- OR-Tools learning curve: ~1 week for engineer unfamiliar with IP

**Estimated effort**: 
- 1 engineer on data pipeline (full-time)
- 1 engineer on OSRM + backend integration (full-time)
- 1 engineer on UI + optimization (part-time)

---

### Phase 2: Equity, Calibration, and Advanced Features (4-6 months)

**Goal**: Add equity metrics, calibrate with real data, multi-objective optimization

**Features**:
1. **Equity metrics dashboard**:
   - Compute maxmin travel time, coverage gap by vulnerability, Gini coefficient
   - Display in scenario comparison table
   - Add "Equity mode" toggle (changes objective from avg to maxmin)

2. **Congestion modeling**:
   - Integrate HERE Traffic API (or manual peak-hour factors)
   - Store time-of-day multipliers in database
   - Recompute travel times for peak hours

3. **Multi-objective optimization**:
   - Add Pareto frontier solver (e.g., minimize cost vs. equity trade-off)
   - Display 5-10 Pareto-optimal solutions, let user pick
   - OR: Let user set equity as a hard constraint ("max travel time ≤ 30 min"), minimize cost

4. **Vulnerability modeling**:
   - Integrate INFORM risk index or city-level poverty data
   - Weight demand by vulnerability (informal settlements get 2x weight)

5. **Flood risk layer**:
   - Download Global Flood Database, compute 10/50/100-year return zones
   - Add "Exclude high flood risk" checkbox in planning panel

6. **Calibration**:
   - If OpenAQ data available, calibrate CAMS PM2.5 with regression
   - If travel survey data available (from city), validate OSRM travel times

7. **PDF export**:
   - Auto-generate report with maps, charts (matplotlib/plotly), scenario descriptions

**External APIs/Datasets**:
- HERE Traffic API
- Global Flood Database
- INFORM Risk Index
- OpenAQ (if available)
- City open data (travel surveys, socioeconomic)

**Risks**:
- HERE API quotas (250k/mo may not be enough for large-scale planning; consider caching)
- Multi-objective optimization slower (Pareto frontier requires solving many problems); may need heuristics

**Estimated effort**: 
- 2 engineers (1 on metrics/optimization, 1 on data + congestion)
- 4-6 months parallel work

---

### Phase 3: Robustness, Research Extensions, and Deployment (6-12 months)

**Goal**: Academic-grade robustness analysis, real-world deployment, extensions

**Features**:
1. **Scenario analysis**:
   - Define 5-10 scenarios (population growth, climate shift, demand shock)
   - For each, re-solve optimization
   - Compute regret, worst-case performance
   - Display robustness heatmap ("This site is good in 8/10 scenarios")

2. **Climate projections**:
   - Download CMIP6 downscaled temperature/precipitation for 2030/2050
   - Recompute heat stress, flood risk under +2°C scenario
   - Show "future-proof" sites

3. **Dynamic capacity**:
   - Model capacity expansion over time (e.g., "Year 1: 3 clinics, Year 5: 2 more")
   - Optimize multi-stage plans

4. **RL-based planning** (research):
   - Train RL agent to select sites sequentially
   - State: current coverage, budget remaining
   - Action: Pick next site
   - Reward: Access improvement
   - Benchmark against OR-Tools

5. **Interactive negotiation**:
   - Multi-stakeholder mode: Different users propose scenarios, system suggests compromises
   - Game-theoretic fair allocation

6. **Deployment**:
   - Deploy to cloud (AWS/GCP), optimize for scale (Redis caching, CDN for tiles)
   - Partner with Almaty municipality or NGO for pilot
   - Collect feedback, iterate

**External APIs/Datasets**:
- CMIP6 climate projections (ESGF)
- City-specific real-time data feeds (if available)

**Risks**:
- Climate projections: Large files (10-100 GB), require HPC or cloud preprocessing
- RL: Requires significant ML engineering, may not outperform OR-Tools for discrete problems
- Deployment: Legal/privacy issues if handling sensitive city data

**Estimated effort**: 
- 2-3 engineers + 1 researcher
- 6-12 months
- Budget for cloud infrastructure (~$500-2k/mo)

---

## Summary & Next Steps

**Immediate priorities**:
1. **Data**: WorldPop + OSM + MODIS/Sentinel-2 → replace all mocks (Week 1-4)
2. **Routing**: Deploy OSRM, integrate travel time queries (Week 5-6)
3. **Optimization**: OR-Tools p-median solver, scenario comparison UI (Week 7-12)

**Quick wins**:
- Real environmental layers → instant credibility
- OSRM travel times → 10x more realistic than Euclidean distance
- OR-Tools optimization → scientifically defensible recommendations

**Long-term research angles** (for MBZUAI):
- Robust optimization under climate uncertainty
- Fairness-aware multi-objective allocation
- RL for sequential planning under budget constraints
- Graph neural networks for facility location (learning to predict optimal sites from structure)

**Key success metrics**:
- **Accuracy**: Travel time predictions within 10% of ground truth (validate with city data or Google Maps API spot-checks)
- **Usability**: 3-5 planners can design and compare scenarios in <30 min (user study)
- **Impact**: 1-2 recommendations adopted by Almaty municipality or NGO within 18 months