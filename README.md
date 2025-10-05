# 🌍 CitySense - NASA Environmental Data Viewer

Note: Nasa Space Apps Challenge — Data Pathways to Healthy Cities and Human Settlements
 
An interactive web application that analyzes city suitability using real-time NASA satellite environmental data. Built for hackathons and urban planning demonstrations.

Space Apps Project Page: https://www.spaceappschallenge.org/2025/find-a-team/elo-ma/?tab=project

![Tech Stack](https://img.shields.io/badge/Stack-NestJS%20%2B%20Vue%203%20%2B%20Leaflet-blue)

## 🎯 Features

- **Interactive Map** - Click anywhere on Earth to analyze location suitability
- **Real NASA GIBS Satellite Layers** - Toggle actual satellite imagery overlays:
  - 🌫️ **Air Quality (AOD)** - MODIS Terra Aerosol Optical Depth (real-time pollution/haze)
  - 🌳 **Vegetation (NDVI)** - MODIS Terra NDVI 16-Day (plant health & greenness)
  - 🌡️ **Surface Temperature** - MODIS Aqua Land Surface Temperature (daytime heat)
  - 💧 **Water Bodies** - VIIRS True Color Imagery (visual water features)
  - 🔥 **Active Fires** - MODIS Terra Thermal Anomalies (bonus layer)

- **Visual Layer Legends** - Color-coded scales showing data ranges and current imagery dates
- **Real-time Scoring** - Comprehensive city suitability scores (0-100)
- **NASA Data Integration** - Dual approach:
  - **GIBS Visual Layers** - Real-time satellite tile imagery (no API key needed!)
  - **API Data** - NASA POWER, GLDAS, SEDAC for detailed scoring

## 🏗️ Architecture

```
CitySense/
├── backend/          # NestJS API server
│   ├── src/
│   │   ├── nasa/     # NASA API integrations
│   │   │   └── services/
│   │   │       ├── power.service.ts      # NASA POWER API
│   │   │       ├── modis.service.ts      # MODIS data (NDVI, LST, AOD)
│   │   │       ├── gldas.service.ts      # GLDAS soil moisture
│   │   │       └── sedac.service.ts      # Population data
│   │   ├── data/     # Data processing
│   │   │   ├── normalization.service.ts  # Data normalization
│   │   │   └── scoring.service.ts        # Score calculation
│   │   └── map/      # REST API endpoints
│   │       ├── map.controller.ts
│   │       └── map.service.ts
│   └── package.json
│
└── frontend/         # Vue 3 + Vite
    ├── src/
    │   ├── components/
    │   │   ├── MapView.vue           # Leaflet map
    │   │   ├── LayerControls.vue     # Layer toggles
    │   │   └── LocationPanel.vue     # Score display
    │   ├── stores/
    │   │   └── mapStore.ts           # Pinia state management
    │   └── services/
    │       └── apiClient.ts          # API client
    └── package.json
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ (recommended: 22.12.0+)
- npm

### 1. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install leaflet axios pinia
npm install --save-dev @types/leaflet
```

### 2. Create Backend .env

Create a `.env` file in the `backend/` folder:

```bash
# backend/.env

# Server
PORT=3000

# GeoNames (REQUIRED for fetching location data on map click)
GEONAMES_USERNAME=your_geonames_username

# NASA AppEEARS (optional; enables real NDVI from MODIS)
NASA_EARTHDATA_USERNAME=your_earthdata_username
NASA_EARTHDATA_PASSWORD=your_earthdata_password

# OpenAI (optional; enables infrastructure recommendations)
OPENAI_API_KEY=your_openai_api_key
```

The backend uses `@nestjs/config` and will automatically load `backend/.env`.

Notes:
- To get a GeoNames username, sign up here: [GeoNames signup](https://www.geonames.org/login)
- Without `GEONAMES_USERNAME`, clicked-point location data (nearest city/population) will fall back to estimates.

### 3. Start the Backend

```bash
cd backend
npm run start:dev
```

Backend runs on `http://localhost:3000`

### 4. Start the Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173`

Dev proxy: the frontend proxies `'/api'` requests to `http://localhost:3000` (see `frontend/vite.config.js`).

### 5. Open the App

Navigate to `http://localhost:5173` in your browser.

If you prefer to bypass the dev proxy, set an explicit API base URL:

```
# frontend/.env.local
VITE_API_BASE_URL=http://localhost:3000/api
```

By default, `frontend/src/services/apiClient.js` uses `VITE_API_BASE_URL` if provided, otherwise falls back to `http://localhost:3000/api`.

Production configuration:

- Set the API base via environment variable to avoid hard-coding URLs:

```
# frontend/.env.production (or .env)
VITE_API_BASE_URL=https://api.your-domain.com/api
```

Deploy the frontend with that env so all API requests go to your backend.

## 📖 How to Use

1. **Toggle NASA Layers** - Use the left sidebar to enable real-time satellite imagery overlays
   - Each layer shows a color-coded legend when active
   - See the actual imagery date (typically 1-3 days old)

2. **Click on the map** - Click anywhere to analyze that location's environmental data
   - Backend fetches detailed scores from NASA APIs
   - Marker shows overall grade (A+ to F)

3. **View Detailed Scores** - Right panel displays:
   - Overall suitability score (0-100)
   - Individual metric scores (air, vegetation, temp, water, urbanization)
   - Raw data values and interpretations

4. **Explore** - Try different cities and compare:
   - Urban areas vs rural
   - Coastal vs inland
   - Different climate zones

## 🎯 API Endpoints

### Get Location Score
```
GET /api/map/score?lat={latitude}&lng={longitude}
```

**Example Response:**
```json
{
  "location": { "lat": 40.7128, "lng": -74.006 },
  "scores": {
    "airQuality": { "score": 75, "aod": 0.25, "interpretation": "Good" },
    "vegetation": { "score": 67, "ndvi": 0.45, "interpretation": "Moderate Vegetation" },
    "temperature": { "score": 80, "current": 22, "unit": "°C" },
    "water": { "score": 70, "soilMoisture": 0.35, "unit": "volumetric" },
    "urbanization": { "score": 85, "populationDensity": 10752, "unit": "people/km²" }
  },
  "overall": {
    "score": 74,
    "grade": "B+",
    "suitability": "Good living conditions"
  },
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

### Get Layer Data
```
GET /api/map/layers/{layerType}?bounds={lat1,lng1,lat2,lng2}
```

### Get Time Series
```
GET /api/map/timeseries?lat={lat}&lng={lng}&metric={metric}
```

## 🔧 Tech Stack

**Backend:**
- NestJS 11
- TypeScript
- Axios (HTTP client)
- Cache Manager (15-min caching)

**Frontend:**
- Vue 3
- Vite 7
- Leaflet.js (maps)
- Pinia (state management)
- Axios (API calls)

**Data Sources:**
- **NASA GIBS** - https://gibs.earthdata.nasa.gov/ (Satellite tile imagery - no auth required!)
- **NASA POWER API** - https://power.larc.nasa.gov/ (Temperature & solar data)
- **NASA MODIS** - Via AppEEARS (NDVI, LST, AOD)
- **NASA GLDAS** - Land surface data (soil moisture)
- **NASA SEDAC** - Population data (GPW)

## 📊 Scoring Methodology

The overall suitability score is a weighted average:

| Factor | Weight | Data Source |
|--------|--------|-------------|
| Air Quality | 25% | MODIS AOD |
| Vegetation | 20% | MODIS NDVI |
| Temperature | 20% | NASA POWER |
| Water | 20% | GLDAS Soil Moisture |
| Urbanization | 15% | SEDAC Population |

### Score Interpretation

- **90-100 (A+/A)** - Excellent living conditions
- **70-89 (B+/B)** - Good living conditions
- **50-69 (C+/C)** - Moderate living conditions
- **30-49 (D)** - Challenging living conditions
- **0-29 (F)** - Difficult living conditions

## 🛠️ Development

### Backend Development
```bash
cd backend
npm run start:dev    # Hot reload
npm run build        # Production build
npm run lint         # Linting
```

### Frontend Development
```bash
cd frontend
npm run dev          # Dev server with HMR
npm run build        # Production build
npm run preview      # Preview production build
```

## 🌐 Deployment

### Backend
```bash
cd backend
npm run build
npm run start:prod
```

### Frontend
```bash
cd frontend
npm run build
# Deploy the 'dist' folder to your hosting service
```

## 🔮 Future Enhancements

- [ ] ✅ ~~Real NASA GIBS satellite layers~~ (DONE!)
- [ ] Date picker to view historical satellite imagery
- [ ] Layer opacity slider controls
- [ ] Historical time series charts with Chart.js
- [ ] Export data as CSV/GeoJSON
- [ ] Compare multiple locations side-by-side
- [ ] User accounts and saved locations
- [ ] Mobile app version
- [ ] Additional GIBS layers (CO₂, Sea Surface Temp, Snow Cover)

## 📝 Notes

### NASA GIBS Layers (Map Overlays)
- **✅ Already Working!** - Real satellite imagery tiles from NASA GIBS servers
- **No Authentication Required** - GIBS provides public tile access
- **Daily Updates** - Imagery typically 1-3 days old
- **WMTS Format** - Standard tile protocol, works directly with Leaflet
- Layer configs in: `frontend/src/config/gibsLayers.ts`

### NASA API Data (Scoring Backend)
- Current implementations use **estimated data** for demo purposes
- To integrate real NASA APIs for scoring:
  - NASA Earthdata account (https://urs.earthdata.nasa.gov/)
  - API keys for AppEEARS, POWER, etc.
  - Update the service files with proper authentication

**Best of Both Worlds:** Visual layers work NOW, backend scoring can be enhanced later!

## 🤝 Contributing

This is a hackathon project! Feel free to fork and enhance it.

## 📄 License

MIT License - feel free to use for your hackathon or educational project!

## 🙏 Acknowledgments

- NASA for providing open environmental data APIs
- Leaflet.js for the amazing mapping library
- The open source community

---

Built with ❤️ for hackathon and urban planning demonstrations
