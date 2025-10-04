# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CitySense is a NASA Environmental Data Viewer built for the NASA Space Apps Challenge. It's an interactive web application that analyzes city suitability using real-time NASA satellite environmental data.

**Tech Stack:**
- Backend: NestJS 11 (TypeScript, NestJS modules pattern)
- Frontend: Vue 3 + Vite 7 (Composition API, Pinia for state, Leaflet.js for maps)
- Data Sources: NASA GIBS (satellite imagery), NASA POWER, MODIS, GLDAS, SEDAC

## Development Commands

### Full Application (Root)
```bash
npm run dev    # Start both backend (port 3001) and frontend (port 5173) concurrently
npm run build  # Build both backend and frontend
```

### Backend (NestJS)
```bash
cd backend
npm install
npm run start:dev      # Hot reload development server (default port 3000)
npm run build          # Production build
npm run start:prod     # Run production build
npm run lint           # ESLint with auto-fix
npm run test           # Run Jest tests
npm run test:watch     # Jest watch mode
npm run test:cov       # Test coverage report
```

### Frontend (Vue 3)
```bash
cd frontend
npm install
npm run dev      # Vite dev server with HMR (port 5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

**Important:** Backend runs on port 3000 by default, but when using root `npm run dev`, it runs on port 3001 via `PORT=3001` env var.

## Architecture

### Backend Structure

**Modular NestJS Architecture:**
- `app.module.ts` - Root module importing MapModule
- `map/` - REST API layer (MapController, MapService)
- `nasa/` - NASA API integrations (PowerService, ModisService, GldasService, SedacService)
- `data/` - Data processing (NormalizationService, ScoringService)

**Key Patterns:**
1. **Dependency Injection:** All services use NestJS DI via constructors
2. **Module Organization:** Each domain (map, nasa, data) is a separate NestJS module
3. **Caching:** MapModule uses `@nestjs/cache-manager` with 15-minute TTL (configured in map.module.ts:10-12)
4. **Parallel Data Fetching:** ScoringService fetches all NASA data in parallel via `Promise.all()` (scoring.service.ts:67-73)

**Scoring Algorithm (scoring.service.ts:92-103):**
- Weighted average: Air Quality (25%), Vegetation (20%), Temperature (20%), Water (20%), Urbanization (15%)
- Each metric normalized to 0-1 range via NormalizationService
- Final score converted to percentage and letter grade (A+ to F)

### Frontend Structure

**Vue 3 Composition API:**
- `App.vue` - Root component
- `components/MapView.vue` - Leaflet map with click handling and NASA GIBS layer rendering
- `components/LocationPanel.vue` - Score display panel
- `components/LayerControls.vue` - Toggle controls for satellite layers
- `stores/mapStore.js` - Pinia store for global state (selected location, scores, active layers)
- `services/apiClient.js` - Axios wrapper for backend API calls
- `config/gibsLayers.js` - NASA GIBS layer configurations

**NASA GIBS Integration:**
- GIBS layers are tile-based overlays (WMTS format) that render directly in Leaflet
- Configuration in `gibsLayers.js` defines layer IDs, URLs, max zoom, opacity, legends
- Supports both raster tiles (temperature, water) and vector MVT tiles (fires/thermal anomalies)
- Vector tiles use `Leaflet.VectorGrid` plugin (see MapView.vue)
- Date placeholders `{date}` are replaced with current/recent dates via `dateUtils.js`

**State Management:**
- Pinia store (`mapStore.js`) manages: selected location, location scores, loading state, error state, active layers
- Components reactively update based on store state changes

**Map Interaction Flow:**
1. User clicks map → MapView emits location
2. App.vue calls apiClient to fetch scores from `/api/map/score?lat=X&lng=Y`
3. Store updates with scores
4. LocationPanel reactively displays results

## Key Implementation Details

### NASA Data Services (backend/src/nasa/services/)
All services currently return **estimated/mock data** for demo purposes. To integrate real NASA APIs:
- Obtain NASA Earthdata credentials at https://urs.earthdata.nasa.gov/
- Update service implementations with proper API endpoints and authentication
- Services use HttpService from `@nestjs/axios` for HTTP requests

### GIBS Layers vs API Data
- **GIBS Layers (frontend):** Real-time satellite imagery tiles that display visually on the map (already working, no auth required)
- **API Data (backend):** Detailed metrics for scoring calculation (currently mock data, needs NASA API integration)

### Cache Management
- Backend caches location scores and layer data for 15 minutes
- Cache keys format: `score_${lat}_${lng}`, `layer_${type}_${bounds}`
- Configured in map.module.ts via CacheModule

### CORS Configuration
- Backend should be configured to allow frontend origin (localhost:5173 in dev)
- Check main.ts for CORS setup if encountering cross-origin issues

## Common Tasks

### Adding a New GIBS Layer
1. Add layer config to `frontend/src/config/gibsLayers.js` in `GIBS_LAYERS` object
2. Add layer toggle to `frontend/src/stores/mapStore.js` in `activeLayers.value`
3. MapView.vue automatically renders layers based on store state

### Adding a New Score Metric
1. Create/update NASA service in `backend/src/nasa/services/`
2. Add data fetching in `ScoringService.calculateScores()` (scoring.service.ts:67-73)
3. Add normalization method in `NormalizationService`
4. Update scoring weights in `scoring.service.ts:92-98`
5. Update `LocationScores` interface (scoring.service.ts:8-46)

### Testing API Endpoints
```bash
# Example: Test location scoring
curl -s "http://localhost:3000/api/map/score?lat=40.7128&lng=-74.006"
```

## Node.js Version
Project requires Node.js 20.19.0+ or 22.12.0+ (see frontend/package.json engines field)
