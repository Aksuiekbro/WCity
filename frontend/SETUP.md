# Frontend Setup Instructions

## ✅ Dependencies Are Pre-Configured!

All required dependencies are now included in `package.json`. Simply run:

```bash
cd frontend
npm install
```

## 📦 Included Dependencies

**Runtime:**
- **leaflet** (^1.9.4) - Interactive map library
- **axios** (^1.7.7) - HTTP client for API calls
- **pinia** (^2.2.8) - State management for Vue 3
- **vue** (^3.5.22) - Vue 3 framework

**Development:**
- **@types/leaflet** (^1.9.14) - TypeScript types for Leaflet
- **@vitejs/plugin-vue** (^6.0.1) - Vue plugin for Vite
- **vite** (^7.1.7) - Build tool and dev server
- **vite-plugin-vue-devtools** (^8.0.2) - Vue DevTools integration

## 🚀 Running the Frontend

```bash
npm run dev
```

The frontend will run on `http://localhost:5173` (or 5174 if 5173 is taken).

## 🔧 Running the Backend

In a separate terminal:

```bash
cd backend
npm run start:dev
```

The backend will run on `http://localhost:3000`.

## 🎯 Features

- **Interactive Map** - Click anywhere to get city suitability scores
- **NASA GIBS Layers** - Real-time satellite imagery overlays:
  - 🌫️ Air Quality (Aerosol Optical Depth)
  - 🌳 Vegetation (NDVI 16-Day)
  - 🌡️ Surface Temperature
  - 💧 Water Bodies (True Color)
- **Visual Legends** - Color-coded scales with imagery dates
- **Real-time Scores** - Comprehensive environmental scoring
- **NASA Data Integration** - Dual approach (GIBS visual + API scoring)

## 🐛 Troubleshooting

### Dependencies Won't Install

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Vite Won't Start

**Error:** "Cannot find module 'magic-string'"

**Solution:** Clean install (above) usually fixes this

### Map Doesn't Load

**Check:**
1. Leaflet is installed: `npm list leaflet`
2. Browser console for errors (F12)
3. Backend is running on port 3000

### GIBS Layers Don't Appear

**Normal behavior:**
- Tiles may take 2-3 seconds to load
- Some 404 errors are normal (GIBS has 1-3 day data delay)
- Layers work best at zoom levels 4-12

## 📁 Project Structure

```
frontend/src/
├── components/
│   ├── MapView.vue           # Leaflet map with GIBS layers
│   ├── LayerControls.vue     # Layer toggles with legends
│   └── LocationPanel.vue     # Score display panel
├── config/
│   └── gibsLayers.ts         # GIBS layer configurations
├── stores/
│   └── mapStore.ts           # Pinia state management
├── services/
│   └── apiClient.ts          # Backend API client
├── utils/
│   └── dateUtils.ts          # Date formatting for GIBS
├── App.vue                   # Main app layout
└── main.js                   # App entry point
```

## 🔗 More Info

- **Quick Start:** `/QUICK-START.md`
- **GIBS Guide:** `/docs/GIBS-LAYERS.md`
- **Main README:** `/README.md`
