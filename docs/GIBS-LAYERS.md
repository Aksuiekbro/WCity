# NASA GIBS Layers Integration Guide

## 🛰️ What is NASA GIBS?

**NASA GIBS (Global Imagery Browse Services)** provides **ready-to-use satellite imagery tiles** that can be directly overlaid on web maps. No data processing required!

- **Free & Public** - No API keys or authentication needed
- **Daily Updates** - Fresh satellite imagery (1-3 day delay)
- **Global Coverage** - Worldwide environmental data
- **Web Map Tiles** - WMTS/XYZ format compatible with Leaflet

## 🗺️ Available Layers in CitySense

### 1. Air Quality (Aerosol Optical Depth)
- **GIBS ID:** `MODIS_Terra_Aerosol`
- **Satellite:** MODIS Terra
- **Update:** Daily
- **Legend:** 0 (clean) to 1.0+ (heavy pollution)
- **Colors:** Green → Yellow → Orange → Red → Dark Red

**What it shows:** Air pollution, haze, dust, smoke

### 2. Vegetation (NDVI)
- **GIBS ID:** `MODIS_Terra_NDVI_16Day`
- **Satellite:** MODIS Terra
- **Update:** 16-day composite
- **Legend:** -0.2 (barren) to 1.0 (dense vegetation)
- **Colors:** Brown → Yellow → Light Green → Dark Green

**What it shows:** Plant health, greenness, forest cover

### 3. Surface Temperature
- **GIBS ID:** `MODIS_Aqua_Land_Surface_Temp_Day`
- **Satellite:** MODIS Aqua
- **Update:** Daily
- **Legend:** -25°C to 45°C
- **Colors:** Blue → Cyan → Green → Yellow → Red

**What it shows:** Land surface temperature during daytime

### 4. Water Bodies (True Color)
- **GIBS ID:** `VIIRS_NOAA20_CorrectedReflectance_TrueColor`
- **Satellite:** VIIRS NOAA-20
- **Update:** Daily
- **Legend:** Visual RGB (natural colors)

**What it shows:** True color satellite imagery, water features, clouds

### 5. Active Fires (Bonus Layer)
- **GIBS ID:** `MODIS_Terra_Thermal_Anomalies_All`
- **Satellite:** MODIS Terra (FIRMS)
- **Update:** Daily
- **Legend:** Thermal anomalies/fire intensity
- **Colors:** Yellow → Orange → Red

**What it shows:** Active fires, thermal hotspots

## 🔧 Technical Implementation

### Tile URL Format
```
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{LAYER_ID}/default/{DATE}/GoogleMapsCompatible_Level{ZOOM}/{z}/{y}/{x}.png
```

### Example URLs

**Air Quality (Oct 1, 2025):**
```
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Aerosol/default/2025-10-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png
```

**Vegetation (16-day composite):**
```
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_16Day/default/2025-10-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png
```

### Date Formats
- **Daily layers:** `YYYY-MM-DD` (e.g., `2025-10-01`)
- **16-day layers:** Aligned to 16-day periods from Jan 1
- **Monthly layers:** First day of month (e.g., `2025-10-01`)

### Zoom Levels
- Most layers: Level 6-9 (global to regional scale)
- High-res layers: Up to Level 9
- `{z}/{y}/{x}` are Leaflet tile coordinates

## 📁 Code Structure

### Configuration File
**Location:** `frontend/src/config/gibsLayers.ts`

```typescript
export const GIBS_LAYERS = {
  airQuality: {
    gibsId: 'MODIS_Terra_Aerosol',
    url: 'https://gibs.earthdata.nasa.gov/wmts/...',
    opacity: 0.6,
    dateFormat: 'daily',
    legend: { min: 0, max: 1.0, colors: [...] }
  },
  // ...
};
```

### Date Utilities
**Location:** `frontend/src/utils/dateUtils.ts`

Functions:
- `getRecentGIBSDate()` - Get date 2 days ago (safe for daily products)
- `get16DayGIBSDate()` - Get aligned 16-day period date
- `formatDateForGIBS()` - Format Date to YYYY-MM-DD

### Map Integration
**Location:** `frontend/src/components/MapView.vue`

```typescript
// Create GIBS layer
const date = getGIBSDateByType(config.dateFormat);
const tileLayer = L.tileLayer(
  config.url.replace('{date}', date),
  { opacity: 0.6, maxZoom: 9 }
);

// Add to map
tileLayer.addTo(map);
```

## 🎨 Adding New GIBS Layers

### Step 1: Find Layer in NASA Worldview
1. Visit: https://worldview.earthdata.nasa.gov/
2. Browse available layers
3. Note the **Layer ID** (e.g., `MODIS_Terra_Aerosol`)

### Step 2: Add to Config
Edit `frontend/src/config/gibsLayers.ts`:

```typescript
newLayer: {
  id: 'newLayer',
  name: 'Layer Name',
  gibsId: 'GIBS_LAYER_ID',
  description: 'What it shows',
  url: getGIBSTileUrl('GIBS_LAYER_ID', '{date}', 9),
  attribution: 'NASA EOSDIS GIBS / Satellite Name',
  opacity: 0.6,
  tileSize: 256,
  maxZoom: 9,
  dateFormat: 'daily',
  legend: {
    min: 0,
    max: 100,
    unit: 'units',
    colors: ['#color1', '#color2', '#color3']
  }
}
```

### Step 3: Add to Map Store
Edit `frontend/src/stores/mapStore.ts`:

```typescript
const activeLayers = ref({
  // ... existing layers
  newLayer: false,
});
```

### Step 4: Add to Layer Controls
Edit `frontend/src/components/LayerControls.vue`:

```typescript
const layers = [
  // ... existing layers
  {
    key: 'newLayer',
    label: 'Layer Name',
    color: '#hexcolor',
    icon: '🌍',
    description: 'Short description'
  }
];
```

### Step 5: Map Layer ID
Edit `frontend/src/config/gibsLayers.ts`:

```typescript
export const LAYER_ID_TO_GIBS = {
  // ... existing mappings
  newLayer: 'newLayer',
};
```

## 🔗 Resources

- **NASA GIBS Documentation:** https://wiki.earthdata.nasa.gov/display/GIBS
- **NASA Worldview (Browse Layers):** https://worldview.earthdata.nasa.gov/
- **Available Layers List:** https://wiki.earthdata.nasa.gov/display/GIBS/GIBS+Available+Imagery+Products
- **WMTS GetCapabilities:** https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities

## 💡 Pro Tips

1. **Layer Opacity** - Set 0.5-0.7 for good overlay visibility
2. **Date Handling** - Always use 2-3 days ago for daily products (processing delay)
3. **16-Day Products** - NDVI updates every 16 days, use appropriate date alignment
4. **Zoom Levels** - Higher levels (9+) may not be available for all products
5. **Attribution** - Always credit NASA EOSDIS GIBS

## 🐛 Troubleshooting

### Layer Not Showing
- Check if date is too recent (use 2-3 days ago)
- Verify GIBS ID is correct
- Check zoom level is within layer's maxZoom
- Inspect browser console for 404 errors

### Blank Tiles
- Date might be outside available range
- For 16-day products, ensure date aligns with periods
- Some products have limited geographic coverage

### Slow Loading
- GIBS tiles are cached, first load may be slow
- Consider reducing opacity for better performance
- Use lower zoom levels for overview

## 🚀 Next Steps

- Add date picker for historical imagery
- Implement layer opacity sliders
- Add more GIBS layers (CO₂, Sea Surface Temp, Snow Cover)
- Create layer groups for easier management
- Add layer info tooltips

---

**Built with NASA GIBS** 🛰️ - Making Earth observation data accessible to everyone!
