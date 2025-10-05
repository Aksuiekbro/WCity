# PRD 1 — Real Environmental & Socioeconomic Data Infrastructure

## 1. Overview
Lay the foundation for credible insights by replacing heuristic environmental data with authoritative rasters and demographic layers. Build ingestion, tiling, and query services so every score, map layer, and optimization routine references traceable sources.

## 2. Problem Statement
Current Nest services (`PowerService`, `GldasService`, `ModisService`, `SedacService`) return climate-based estimates or random fallbacks. These values cannot be audited, cited, or trusted by planners, preventing pilot deployments with governments or NGOs.

## 3. Target Users
- Urban planners needing defensible hazard/suitability metrics at parcel level.
- Policy analysts preparing reports, grant proposals, or EIA submissions.
- Backend optimization services that require accurate inputs for demand, constraints, and risk calculations.

## 4. Objectives & Success Criteria
1. 100% of suitability metrics sourced from real datasets with documented provenance (no heuristics).
2. Point queries (`lat/lng`) and viewport requests return cached values within 500 ms p95 for core AOIs.
3. Publish a data catalog describing each layer’s source, units, update cadence, and QA status.

## 5. Functional Requirements
- **Raster ingestion/ETL**: Download, clip, reproject, and tile rasters (COG/MBTiles); store metadata in Postgres.
- **Query microservice**: `GET /data/<layer>?lat&lng` (single/batch) returning value, units, timestamp, source ID.
- **Tile serving**: WMTS/WMS endpoints (TiTiler, MapServer, or GeoServer) powering frontend overlays.
- **Population aggregation**: Load WorldPop 100 m grids (age/sex) + GHSL settlement layers; aggregate to 500 m demand cells.
- **Vulnerability indices**: Join INFORM Risk, poverty shapefiles, and optional municipal deprivation indicators to demand grid.
- **Monitoring**: Automated checks for missing downloads, unexpected value ranges, and stale caches.

## 6. Service Replacement Mapping
| Current Service / Mock | Limitation | Recommended Replacement | Notes |
|------------------------|------------|--------------------------|-------|
| `PowerService.getTemperatureData` (fallback to 20 °C) | Static constant, ignores spatial/temporal variation | **MODIS MOD11A1 LST** (1 km, daily) + **ERA5-Land 2 m temp** (9 km, hourly) via NASA AppEEARS + Copernicus CDS | Cache monthly composites, expose both current snapshots and climatology |
| `GldasService.estimateSoilMoisture` | Latitude sine heuristic, no soil physics | **SMAP L3** soil moisture (9 km, daily) and **GLDAS-2.1** (0.25° 3-hourly) via NASA Earthdata | Blend SMAP for spatial detail, GLDAS for temporal continuity |
| `ModisService.getNDVI`/`getLST`/`getAOD` (climate-based estimates + random variation) | Cannot capture urban heterogeneity or real pollution events | **MODIS MOD13Q1 NDVI** (250 m 16-day), **Sentinel-2 NDVI** (10 m), **CAMS reanalysis PM2.5 / AOD**, **Sentinel-5P TROPOMI** for NO₂/SO₂ | Sentinel-2 via Copernicus Data Space or GEE; CAMS via CDS API, calibrated with OpenAQ |
| `SedacService.getPopulationDensity` (randomized fallback <20 pop/km²) | Unrealistic densities in remote areas; no age structure | **WorldPop 100 m** (with age bands) + **GHSL** population/built-up + **World Bank/CIESIN poverty layers** | Aggregate to planning grid; include demand multipliers per demographic |
| No dedicated land-cover layer | Cannot constrain siting (e.g., avoid water bodies) | **ESA WorldCover 10 m**, **Dynamic World** | Use for mask/constraints and UI overlays |
| No flood/drought baselines | Hazards ignored or approximated | **Global Flood Database**, **GFMS**, **JRC Global Surface Water**, **SPEI/SPI drought indices** | Precompute 10/50/100-year flood zones; monthly drought anomalies |

## 7. Data Sources & Access
| Domain | Dataset/API | Access Mode | Refresh | Storage |
|--------|-------------|------------|---------|---------|
| Temperature | MODIS MOD11A1, ERA5-Land | AppEEARS, CDS API | Monthly | S3/COG + PostGIS metadata |
| Soil Moisture | SMAP L3, GLDAS-2.1 | Earthdata HTTPS/OPeNDAP | Weekly | S3/COG |
| Vegetation | MODIS MOD13Q1, Sentinel-2 NDVI | AppEEARS, Copernicus | Monthly | S3/COG + vector tiles |
| Air Quality | CAMS reanalysis, OpenAQ | CDS API, REST | Monthly + daily | Postgres + time-series cache |
| Land Cover | ESA WorldCover, Dynamic World | Direct download, GEE | Annual / near-real-time | S3/COG |
| Population | WorldPop, GHSL | FTP / GEE | Annual | PostGIS raster/vector |
| Vulnerability | INFORM Risk, poverty layers | Direct download | Annual | PostGIS |
| Hazards | Global Flood DB, GFMS, SPEI | Google Cloud, NASA | Quarterly / 3-hourly | S3/COG + downsampled tiles |

## 8. Non-Functional Requirements
- Automated CI job verifying checksum + coverage for each dataset update.
- Role-based access to ingestion scripts (Earthdata credentials).
- Observability: metrics for download duration, tile generation latency, API cache hit rate.

## 9. Timeline & Resources
- Estimated 8–10 weeks, 1 data engineer + 1 infra engineer.
- Milestones: (1) ingestion pipeline MVP, (2) query API + tiles online, (3) data catalog published.

## 10. Risks & Mitigations
- **Large rasters** → Clip to AOIs; use Cloud Optimized GeoTIFF to stream partial reads.
- **API quota/credential failures** → Cache tokens securely; add retries + fallbacks to previous timestep.
- **Data gaps (cloud cover)** → Blend MODIS + Sentinel-2 + ERA5 to ensure continuity.
