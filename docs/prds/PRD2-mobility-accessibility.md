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

## 6. Service Replacement Mapping
| Current Behavior / Service | Limitation | Recommended Service / Integration | Notes |
|---------------------------|------------|-----------------------------------|-------|
| Frontend proximity checks using Leaflet distance or bounding boxes | Ignores real network, obstacles, congestion | **MobilityService (new)** backed by **OSRM** with car & walk profiles | Deploy via Docker; update from Geofabrik extracts |
| No congestion awareness | Same result for peak/off-peak | **HERE Traffic Flow API** (speed factors) or configurable slowdown matrix | Cache per road class + hour; apply multipliers to OSRM base speeds |
| No isochrone visualization | Users can’t see catchments | `IsochroneService` generating GeoJSON from OSRM results | Render via MapLibre/Leaflet vector layers |
| No travel-time matrices | Optimization stuck with Euclidean assumptions | `/mobility/matrix` + Redis cache | Batches 100–500 origin/dest pairs |
| No transit modeling | Underserves car-free residents | **GTFS ingest + OpenTripPlanner** (Phase 2) | Only if GTFS available; otherwise planned capability |

## 7. Data & Integrations
- **OpenStreetMap** (Geofabrik `kazakhstan-latest.osm.pbf`)
- **OSRM** (self-hosted; car, foot profiles)
- **HERE Traffic API** (Flow + Incidents) for congestion factors
- **Potential**: GTFS feeds (Almaty transit), OpenRouteService, Valhalla (if multi-modal needed)

## 8. Success Metrics
- Matrix request latency ≤2 s for 200×200 pairs (cached) and ≤5 s uncached.
- Isochrones render in UI within 1 s after request.
- Validation study: average OSRM travel time within 10% of Google Maps across 30 OD samples.

## 9. Timeline & Resources
- 4–6 weeks for OSRM + basic APIs (1 infra engineer, 0.5 backend engineer).
- +4 weeks for congestion integration + QA.

## 10. Risks & Mitigations
- **Compute footprint** → Use dedicated VM (16 GB RAM) or managed container; shard graphs by region if expansion needed.
- **API quota (HERE)** → Cache hourly speed factors, schedule updates during off-peak; evaluate paid tier if required.
- **Transit data unavailable** → Clearly flag feature as pending; default to walking/drive until GTFS acquired.
