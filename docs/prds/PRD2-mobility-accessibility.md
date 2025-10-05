# PRD 2 — Network-Aware Mobility & Accessibility Platform

## 1. Overview
Deliver realistic travel-time analytics by introducing routing, congestion modeling, and multimodal access services that replace Euclidean-distance heuristics in the planning flow.

## 2. Problem Statement
The frontend currently assumes straight-line proximity when recommending sites. Without a routing service, bridges, rivers, one-way streets, and congestion are ignored, leading to misleading coverage estimates.

## 3. Target Users
- City planners validating that ≥80% of a priority population reaches a facility within 30 minutes.
- Mobility analysts assessing overloaded corridors and blackout zones.
- Optimization engine (PRD 3) requiring travel-time matrices for objective functions.

## 4. Objectives
1. Stand up a production-grade routing backend (OSRM or equivalent) with Kazakhstan baseline coverage.
2. Provide APIs for isochrones, matrix routing, and congestion-adjusted speeds consumable by frontend + optimization services.
3. Visualize access (drive, walk, optional transit) directly in the UI.

## 5. Functional Requirements
- **Routing engine deployment**: Self-host OSRM (Docker) with up-to-date OSM extracts; nightly/weekly data refresh.
- **APIs**:
  - `POST /mobility/matrix` → travel-time matrix for ≤500 origin/destination pairs.
  - `GET /mobility/isochrone?lat&lng&mode` → GeoJSON polygon(s) for 10/20/30/45-minute thresholds.
  - `GET /mobility/route` → detailed route geometry, travel time, and distance for UI overlays.
- **Congestion modeling**: Integrate HERE Traffic API (free tier) or configurable slowdown factors per road class/time of day; store hourly multipliers.
- **Caching**: Memoize repeated matrices per viewport + constraint set; use Redis to keep response times <2 s.
- **QA & Monitoring**: Scheduled comparison of sampled OD pairs against Google Maps or municipal benchmarks; alert on >10% deviation.
- **Multimodal roadmap**: Phase 1 = driving + walking; Phase 2 = GTFS ingest + OpenTripPlanner/R5 for public transit if data exists.

## 6. Service Replacement Mapping & Implementation Details
| Current Behavior / Service | Limitation | Recommended Service / Integration | API Endpoint & Setup | Implementation Notes |
|---------------------------|------------|-----------------------------------|----------------------|----------------------|
| Frontend proximity checks using Leaflet distance or bounding boxes | Ignores real network, obstacles, congestion | **MobilityService (new)** backed by **OSRM** with car & walk profiles | **OSRM Docker**: `docker run -t -i -p 5000:5000 -v "${PWD}:/data" osrm/osrm-backend osrm-routed --algorithm mld /data/kazakhstan-latest.osrm`. Download OSM extract from Geofabrik (`https://download.geofabrik.de/asia/kazakhstan-latest.osm.pbf`). Expose endpoints: `GET http://localhost:5000/route/v1/driving/{coords}`, `GET http://localhost:5000/table/v1/driving/{coords}`, `GET http://localhost:5000/isochrone/v1/driving/{coords}`. | Update OSM data weekly via cron; preprocess graph with `osrm-extract` and `osrm-contract`. Cache results in Redis (key: hash of origin/dest/mode). Use `osrm-isochrone` library or TurfJS for polygon generation. |
| No congestion awareness | Same result for peak/off-peak | **HERE Traffic Flow API** (speed factors) or configurable slowdown matrix | **HERE API**: `GET https://data.traffic.hereapi.com/v7/flow?locationReferencing=shape&apiKey={key}`. Returns speed/freeflow per road segment. Apply multipliers to OSRM speeds: `adjusted_time = osrm_time * (freeflow_speed / current_speed)`. | Free tier: 250k transactions/month. Cache speed factors hourly in Postgres (table: `congestion_factors`); update via scheduled job. Fallback: Manual slowdown matrix (e.g., arterials 0.5x peak, residential 0.8x). |
| No isochrone visualization | Users can't see catchments | `IsochroneService` generating GeoJSON from OSRM results | Use OSRM `/isochrone` or compute via Dijkstra on OSRM graph. Return GeoJSON FeatureCollection: `{ "type": "FeatureCollection", "features": [{ "type": "Feature", "properties": { "time": 20 }, "geometry": {...} }] }`. | Render in MapLibre/Leaflet with `L.geoJSON(data, { style: (feature) => ({ color: getColor(feature.properties.time) }) })`. Pre-compute for major facilities (hospitals) and cache. |
| No travel-time matrices | Optimization stuck with Euclidean assumptions | `/mobility/matrix` + Redis cache | `POST /api/mobility/matrix` with JSON: `{ "origins": [[lat, lng], ...], "destinations": [...], "mode": "driving" }`. Returns `{ "durations": [[time_ij]], "distances": [[dist_ij]] }` (N×M matrix). Proxy to OSRM `/table/v1/{profile}/{coordinates}`. | Batches 100–500 OD pairs (OSRM limit ~1k). Cache with TTL=24h (key: hash of sorted coords + mode). For optimization: query once per viewport, reuse across solves. |
| No transit modeling | Underserves car-free residents | **GTFS ingest + OpenTripPlanner** (Phase 2) | **OTP Docker**: `docker run -p 8080:8080 -v /path/to/gtfs:/var/otp/graphs opentripplanner/opentripplanner --build --serve`. Download GTFS feed (Almaty: check government or transitfeeds.com). Query: `GET http://localhost:8080/otp/routers/default/plan?fromPlace={lat},{lng}&toPlace={lat},{lng}&mode=TRANSIT,WALK`. | Only if GTFS available; otherwise mark as planned capability. Parse GTFS with `gtfs-kit` Python library for validation before OTP ingest. |

## 7. Data & Integrations
- **OpenStreetMap** (Geofabrik `kazakhstan-latest.osm.pbf`): Download from `https://download.geofabrik.de/asia/kazakhstan-latest.osm.pbf`. Update weekly via cron.
- **OSRM** (self-hosted; car, foot profiles): Use Docker or compile from source. Profiles defined in `car.lua`, `foot.lua` (adjust speeds, penalties).
- **HERE Traffic API** (Flow + Incidents) for congestion factors: Free tier at developer.here.com. Rate limits: 250k API calls/month.
- **Potential**: GTFS feeds (Almaty transit), OpenRouteService (alternative to OSRM, supports wheelchair access), Valhalla (more profiles, but heavier).

## 8. Success Metrics
- Matrix request latency ≤2 s for 200×200 pairs (cached) and ≤5 s uncached.
- Isochrones render in UI within 1 s after request.
- Validation study: average OSRM travel time within 10% of Google Maps across 30 OD samples.

## 9. Example API Flows

### Isochrone Generation
**Request**: `GET /api/mobility/isochrone?lat=43.2220&lng=76.8512&mode=driving&time=20`  
**Backend**:
1. Query OSRM: `GET http://localhost:5000/isochrone/v1/driving/76.8512,43.2220?contours=20`
2. Parse GeoJSON, apply congestion adjustment if peak hour (multiply contour time by `1.3`).
3. Return GeoJSON FeatureCollection.

**Frontend**: Render with `L.geoJSON(data, { style: { color: '#3498db', fillOpacity: 0.3 } }).addTo(map)`.

### Travel-Time Matrix for Optimization
**Request**: `POST /api/mobility/matrix` with `{ "origins": [[43.22, 76.85], ...], "destinations": [[43.25, 76.90], ...], "mode": "car" }`  
**Backend**:
1. Hash inputs, check Redis cache.
2. If miss: Query OSRM `/table/v1/driving/{coords}` (coords = `origin1_lng,origin1_lat;origin2_lng,origin2_lat;...;dest1_lng,dest1_lat;...`).
3. Parse response: `{ "durations": [[120, 240], [180, 150]] }` (seconds).
4. Store in Redis (TTL 24h), return JSON.

**Optimization service** consumes matrix as constraint: `travel_time[i][j] ≤ 30 * 60` (30 minutes).

## 10. Timeline & Resources
- 4–6 weeks for OSRM + basic APIs (1 infra engineer, 0.5 backend engineer).
- +4 weeks for congestion integration + QA.

## 11. Risks & Mitigations
- **Compute footprint** → Use dedicated VM (16 GB RAM) or managed container; shard graphs by region if expansion needed.
- **API quota (HERE)** → Cache hourly speed factors, schedule updates during off-peak; evaluate paid tier if required.
- **Transit data unavailable** → Clearly flag feature as pending; default to walking/drive until GTFS acquired.
