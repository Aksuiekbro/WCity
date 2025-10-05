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
3. Publish a data catalog describing each layer's source, units, update cadence, and QA status.

## 5. Functional Requirements
- **Raster ingestion/ETL**: Download, clip, reproject, and tile rasters (COG/MBTiles); store metadata in Postgres.
- **Query microservice**: `GET /data/<layer>?lat&lng` (single/batch) returning value, units, timestamp, source ID.
- **Tile serving**: WMTS/WMS endpoints (TiTiler, MapServer, or GeoServer) powering frontend overlays.
- **Population aggregation**: Load WorldPop 100 m grids (age/sex) + GHSL settlement layers; aggregate to 500 m demand cells.
- **Vulnerability indices**: Join INFORM Risk, poverty shapefiles, and optional municipal deprivation indicators to demand grid.
- **Monitoring**: Automated checks for missing downloads, unexpected value ranges, and stale caches.

## 6. Service Replacement Mapping & Implementation Details
| Current Service / Mock | Limitation | Recommended Replacement | API Endpoint & Implementation | Credentials & Setup |
|------------------------|------------|--------------------------|-------------------------------|---------------------|
| `PowerService.getTemperatureData` (fallback to 20 °C) | Static constant, ignores spatial/temporal variation | **MODIS MOD11A1 LST** (1 km, daily) + **ERA5-Land 2 m temp** (9 km, hourly) | **MODIS**: `POST https://appeears.earthdatacloud.nasa.gov/api/task` with JSON payload specifying product, date range, AOI; **ERA5**: Use `cdsapi` Python package (`pip install cdsapi`), download via `c.retrieve('reanalysis-era5-land', {...})`. Cache monthly composites as COG. | NASA Earthdata account (urs.earthdata.nasa.gov); CDS registration (cds.climate.copernicus.eu). Store credentials in `.netrc` or env vars. |
| `GldasService.estimateSoilMoisture` | Latitude sine heuristic, no soil physics | **SMAP L3** soil moisture (9 km, daily) and **GLDAS-2.1** (0.25° 3-hourly) | **SMAP**: `https://n5eil01u.ecs.nsidc.org/SMAP/SPL3SMP.006/` (HTTPS download); **GLDAS**: `https://hydro1.gesdisc.eosdis.nasa.gov/opendap/GLDAS/GLDAS_NOAH025_3H.2.1/` (OPeNDAP). Use `earthaccess` Python library for authentication and downloads. Query rasters via rasterio for point/viewport. | NASA Earthdata account; use `earthaccess.login()` in scripts. Store tokens securely. |
| `ModisService.getNDVI`/`getLST`/`getAOD` (climate-based estimates + random variation) | Cannot capture urban heterogeneity or real pollution events | **MODIS MOD13Q1 NDVI** (250 m 16-day), **Sentinel-2 NDVI** (10 m), **CAMS reanalysis PM2.5 / AOD**, **Sentinel-5P TROPOMI** for NO₂/SO₂ | **Sentinel-2**: Copernicus Data Space API `https://dataspace.copernicus.eu/api` or SentinelHub Processing API (https://services.sentinel-hub.com/api/v1/process); compute NDVI from B4 (red) / B8 (NIR). **CAMS**: CDS API (`c.retrieve('cams-global-reanalysis-eac4', {...})`). **OpenAQ calibration**: `GET https://api.openaq.org/v2/measurements?location_id={id}&parameter=pm25&date_from={start}`. Use linear regression to bias-correct CAMS with ground truth. | Copernicus registration for Sentinel-2/CAMS; OpenAQ no auth. GEE alternative: service account JSON key. |
| `SedacService.getPopulationDensity` (randomized fallback <20 pop/km²) | Unrealistic densities in remote areas; no age structure | **WorldPop 100 m** (with age bands) + **GHSL** population/built-up + **World Bank/CIESIN poverty layers** | **WorldPop**: `ftp://ftp.worldpop.org.uk/GIS/Population/Global_2000_2020/` (FTP download); **GHSL**: `https://ghsl.jrc.ec.europa.eu/download.php` (direct download); **INFORM Risk**: `https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Results-and-data/Download-data`. Load GeoTIFFs into PostGIS with `raster2pgsql`. Aggregate to 500m grid with zonal statistics. | No auth for WorldPop/GHSL/INFORM. Use `gdalwarp` for reprojection, PostGIS for storage. |
| No dedicated land-cover layer | Cannot constrain siting (e.g., avoid water bodies) | **ESA WorldCover 10 m**, **Dynamic World** | **ESA**: `https://esa-worldcover.org/en/data-access` or AWS S3 `s3://esa-worldcover/v100/2020/map/` (download via `aws s3 cp` or direct HTTP); **Dynamic World**: Google Earth Engine API (`ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')`). Rasterize to planning grid for constraints. | None for ESA (public S3); GEE service account for Dynamic World. Use `rio-cogeo` to convert to COG. |
| No flood/drought baselines | Hazards ignored or approximated | **Global Flood Database**, **GFMS**, **JRC Global Surface Water**, **SPEI/SPI drought indices** | **Flood DB**: `gs://global-flood-db/` (Google Cloud Storage; use `gsutil cp` or `gcloud storage cp`); **GFMS**: `https://gfms.gsfc.nasa.gov/` (HTTPS; real-time NetCDF); **JRC Water**: Download portal; **SPEI**: `https://iridl.ldeo.columbia.edu/` (Data Library API). Precompute flood zones as polygons (10/50/100-yr return); compute SPEI monthly from ERA5. | GCS billing account for Flood DB; no auth for GFMS/SPEI. Process NetCDF with xarray, vectorize flood extents with GDAL. |

## 7. Data Sources & Access
| Domain | Dataset/API | Access Mode | API Endpoint / URL | Credentials | Refresh | Storage |
|--------|-------------|------------|-------------------|------------|---------|---------|
| Temperature | MODIS MOD11A1, ERA5-Land | AppEEARS, CDS API | `POST https://appeears.earthdatacloud.nasa.gov/api/task` (MODIS); CDS API via `cdsapi` Python | NASA Earthdata login (urs.earthdata.nasa.gov); CDS registration (cds.climate.copernicus.eu) | Monthly | S3/COG + PostGIS metadata |
| Soil Moisture | SMAP L3, GLDAS-2.1 | Earthdata HTTPS/OPeNDAP | `https://n5eil01u.ecs.nsidc.org/SMAP/` (SMAP); `https://hydro1.gesdisc.eosdis.nasa.gov/opendap/` (GLDAS) | NASA Earthdata login; use `earthaccess` Python library for auth | Weekly | S3/COG |
| Vegetation | MODIS MOD13Q1, Sentinel-2 NDVI | AppEEARS, Copernicus Data Space | AppEEARS API (as above); Copernicus: `https://dataspace.copernicus.eu/api` or SentinelHub Processing API | Earthdata (MODIS); Copernicus registration for Sentinel-2 | Monthly | S3/COG + vector tiles |
| Air Quality | CAMS reanalysis, OpenAQ | CDS API, REST | CDS API via `cdsapi`; OpenAQ: `GET https://api.openaq.org/v2/measurements` | CDS registration; OpenAQ no auth required | Monthly + daily | Postgres + time-series cache |
| Land Cover | ESA WorldCover, Dynamic World | Direct download, GEE | ESA: `https://esa-worldcover.org/en/data-access` or AWS S3 `s3://esa-worldcover/`; Dynamic World via GEE API | None (ESA); GEE service account (Google Cloud) | Annual / near-real-time | S3/COG |
| Population | WorldPop, GHSL | FTP / GEE / direct download | WorldPop: `ftp://ftp.worldpop.org.uk/`; GHSL: `https://ghsl.jrc.ec.europa.eu/download.php` | None | Annual | PostGIS raster/vector |
| Vulnerability | INFORM Risk, poverty layers | Direct download | INFORM: `https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Results-and-data`; SEDAC poverty via Earthdata | Earthdata (SEDAC) | Annual | PostGIS |
| Hazards | Global Flood DB, GFMS, SPEI | Google Cloud, NASA, IRI | Flood DB: `gs://global-flood-db/`; GFMS: `https://gfms.gsfc.nasa.gov/`; SPEI: `https://iridl.ldeo.columbia.edu/` | GCS billing account (Flood DB); None (GFMS, SPEI) | Quarterly / 3-hourly | S3/COG + downsampled tiles |

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
