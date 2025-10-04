## CitySense MVP — Planning Document

### Goal
- **Build a minimal, runnable MVP** that helps urban planners explore heat, flood, air-quality, and green-equity signals and test simple “what-if” scenarios.

### Core Deliverables (MVP)
- **Data pipeline** with synthetic demo + hooks for real data
- **Indices**: UHI (Cooling Gap), FSI, AQE, GEI
- **Streamlit app** for interactive layers and scwenario sliders
- **Docs**: README with setup/run instructions

### Directory Layout
```text
.
├── data
│   ├── aoi.geojson
│   ├── rasters/                # input rasters (synthetic by default)
│   └── indices/                # computed UHI/FSI/AQE/GEI GeoTIFFs + PNGs
├── scripts
│   ├── 00_make_synthetic_demo.py
│   ├── 02_preprocess_align.py
│   └── 03_compute_indices.py
├── citysense
│   ├── __init__.py
│   ├── io.py
│   ├── indices.py
│   └── scenarios.py
├── streamlit_app.py
├── requirements.txt
└── README.md
```

### Indices (simple definitions)
- **UHI Cooling Gap**: \( z(\text{LST}) + z(\text{POP}) - z(\text{CANOPY}) \)
- **FSI (Flood)**: \( a\,z(\text{RAIN\_MAX24h}) + b\,z(\text{FLOW\_ACCUM}) + c\,z(\text{SOIL\_WETNESS}) \) with \(a=0.4, b=0.3, c=0.3\)
- **AQE (Air Quality Exposure)**: \( z(\text{NO2}) + z(\text{AOD}) \)
- **GEI (Green Equity)**: \( z(\text{POP}) - z(\text{CANOPY}) \) or \( z(\text{POP}) - 0.5\,[z(\text{CANOPY})+z(\text{NDVI})] \) if NDVI available

Notes:
- Use masked arrays; ignore nodata in stats. Z-score funcs should return zeros when variance ~ 0.

### Data Inputs
- Synthetic demo rasters so the app runs anywhere
- Real-data hooks (to be swapped later):
  - LST: ECOSTRESS or Landsat 8/9
  - Rain: GPM IMERG extremes
  - Flow: SRTM/NASADEM-derived flow accumulation
  - Soil wetness: SMAP (scaled 0–1)
  - NO₂: OMI tropospheric column
  - AOD: MODIS-MAIAC
  - Canopy/NDVI: GEDI/NDVI proxy
  - Population: SEDAC GPW or equivalent

### Implementation Steps (Checklist)
- [ ] Python env + dependencies (`requirements.txt`)
- [ ] `citysense/io.py`: read/write rasters, resample-to-match utility
- [ ] `citysense/indices.py`: z-score + UHI/FSI/AQE/GEI
- [ ] `citysense/scenarios.py`: tree planting, cool roofs, bus electrification, drainage
- [ ] `scripts/00_make_synthetic_demo.py`: generate demo rasters
- [ ] `scripts/02_preprocess_align.py`: align rasters to reference grid (stub)
- [ ] `scripts/03_compute_indices.py`: compute and save GeoTIFF + PNG previews
- [ ] `streamlit_app.py`: layer switcher + scenario sliders + KPIs
- [ ] `README.md`: quick start, data replacement guide, folder layout

### Quick Start (intended UX)
```bash
# 1) Create env and install deps
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2) (Optional) Generate synthetic rasters (provided by default)
python scripts/00_make_synthetic_demo.py

# 3) Compute indices (works with synthetic rasters)
python scripts/03_compute_indices.py

# 4) Launch the app
streamlit run streamlit_app.py
```

### Scenario Controls (Streamlit)
- Tree planting: canopy increase (%)
- Cool roofs: roof coverage fraction + LST reduction (°C)
- Bus electrification: NO₂ reduction (%) along corridors
- Drainage upgrade: FSI proportional reduction (%)

### Acceptance Criteria
- Project runs end-to-end with synthetic rasters
- Four indices produced as GeoTIFF + PNG
- Streamlit app loads, toggles layers, and applies scenarios without errors
- README enables a new user to reproduce results on a clean machine

### Risks/Assumptions
- Synthetic rasters approximate patterns; real-data integration may change ranges/scales
- Alignment step required when swapping in real rasters (CRS, resolution, extent)

### Next Steps
- Add NDVI option in GEI computation path
- Add corridor/roof masks for spatially targeted scenarios
- Add colorbars and legends in app
- Add export (GeoTIFF/PNG) buttons from the UI


