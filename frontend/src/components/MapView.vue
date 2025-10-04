<script setup>
import { onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat'; // Population heatmap plugin
import { useMapStore } from '../stores/mapStore';
import { apiClient } from '../services/apiClient';
import { GIBS_LAYERS, LAYER_ID_TO_GIBS } from '../config/gibsLayers';
import { resolveGIBSDate } from '../utils/dateUtils';
import 'leaflet.vectorgrid';

// Fix Leaflet default icon paths for Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const mapStore = useMapStore();
const mapContainer = ref(null);
let map = null;
let marker = null;
let heatmapLayer = null; // Population density heatmap
let currentZoom = 10;
const HEATMAP_MIN_ZOOM = 10; // Show heatmap at zoom 10+

// Store GIBS layer instances
const gibsLayers = new Map();

// Store Infrastructure layer groups (hospitals, schools)
const infraLayerGroups = new Map();

onMounted(() => {
  if (!mapContainer.value) return;

  // Initialize Leaflet map
  map = L.map(mapContainer.value).setView([40.7128, -74.006], 10); // NYC default

  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  // Initialize NASA GIBS layers (don't add to map yet)
  Object.entries(LAYER_ID_TO_GIBS).forEach(([layerId, gibsId]) => {
    const config = GIBS_LAYERS[gibsId];
    if (!config) return;

    // Get appropriate date for this layer type
    const date = resolveGIBSDate(config.dateFormat, mapStore.gibsDate);

    // Create layer (raster PNG vs vector MVT)
    if (config.isVector) {
      const mvtUrl = config.mvtUrl.replace('{date}', date);

      const vectorLayer = L.vectorGrid.protobuf(mvtUrl, {
        maxNativeZoom: config.maxZoom, // Native tile zoom (7 for fires)
        maxZoom: 19, // Allow scaling to higher zooms
        interactive: false,
        rendererFactory: L.canvas.tile,
        vectorTileLayerStyles: {
          // Correct source-layer name from GIBS metadata (FIRMS_MODIS_Thermal_Anomalies)
          'FIRMS_MODIS_Thermal_Anomalies': function(properties, zoom, geometryDimension) {
            // Only style point features (geometryDimension === 1)
            if (geometryDimension === 1) {
              // Optional: Dynamic styling based on Fire Radiative Power (FRP)
              const frp = properties.FRP || 0;
              const confidence = properties.CONFIDENCE || 0;

              // Color based on fire intensity
              let fillColor = '#ff9900'; // Default orange
              if (frp > 200) fillColor = '#ff0000';      // High intensity: red
              else if (frp > 100) fillColor = '#ff3b30'; // Medium: bright red-orange

              return {
                radius: Math.min(3 + (frp / 100), 6), // Scale by FRP, max 6px
                weight: 1,
                fillColor: fillColor,
                fillOpacity: confidence > 80 ? 0.9 : 0.7, // Higher opacity for confident detections
                color: '#ff0000',
                fill: true
              };
            }
            return {}; // Fallback for non-point geometries
          }
        },
        getFeatureId: (feature) => {
          return feature.properties.id || feature.properties.fid || Math.random();
        },
        // Prevent wrapping and limit to valid geographic bounds
        noWrap: true,
        bounds: L.latLngBounds(L.latLng(-85.051129, -180), L.latLng(85.051129, 180)),
      });

      // Debug: Log when tiles load/error
      vectorLayer.on('load', () => {
        console.log(`✓ MVT layer ${gibsId} loaded successfully`);
      });

      vectorLayer.on('tileerror', (e) => {
        console.warn(`⚠ MVT tile error for ${gibsId}:`, e);
      });

      // Attach metadata for later use
      vectorLayer._gibsMaxZoom = config.maxZoom;
      vectorLayer._gibsId = gibsId;
      gibsLayers.set(layerId, vectorLayer);
    } else {
      // Raster tile fallback
      const tileLayer = L.tileLayer(config.url.replace('{date}', date), {
        attribution: config.attribution,
        opacity: config.opacity,
        tileSize: config.tileSize,
        maxNativeZoom: config.maxZoom,
        maxZoom: 19,
        noWrap: true,
        bounds: L.latLngBounds(L.latLng(-85.051129, -180), L.latLng(85.051129, 180)),
        updateWhenIdle: true,
        detectRetina: true,
      });
      tileLayer._gibsMaxZoom = config.maxZoom;
      tileLayer._gibsId = gibsId;
      gibsLayers.set(layerId, tileLayer);
    }
  });

  // Handle map clicks
  map.on('click', async (e) => {
    const { lat, lng } = e.latlng;

    // Add/update marker
    if (marker) {
      marker.setLatLng([lat, lng]);
    } else {
      marker = L.marker([lat, lng]).addTo(map);
    }

    // Fetch scores
    mapStore.setLoading(true);
    mapStore.setSelectedLocation(lat, lng);

    try {
      const scores = await apiClient.getLocationScore(lat, lng);
      mapStore.setLocationScores(scores);
      mapStore.setError(null);

      // Update marker popup
      marker.bindPopup(`
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 10px 0;">City Score: ${scores.overall.grade}</h3>
          <p style="margin: 5px 0;"><strong>Overall:</strong> ${scores.overall.score}%</p>
          <p style="margin: 5px 0; font-size: 12px;">${scores.overall.suitability}</p>
        </div>
      `).openPopup();
    } catch (error) {
      console.error('Error fetching scores:', error);
      mapStore.setError('Failed to fetch location data');
    } finally {
      mapStore.setLoading(false);
    }
  });

  // Handle zoom changes for hybrid visualization
  map.on('zoomend', () => {
    currentZoom = map.getZoom();
    updatePopulationHeatmap();
    updateVisibleInfrastructure();
  });

  // Handle map movement to update heatmap data
  map.on('moveend', () => {
    updatePopulationHeatmap();
    updateVisibleInfrastructure();
  });

  // Initial heatmap update
  updatePopulationHeatmap();
});

/**
 * Update population density heatmap based on current viewport and zoom
 * Shows heatmap at zoom 10+, uses GeoNames city data
 */
async function updatePopulationHeatmap() {
  if (!map) {
    console.warn('⚠ Heatmap update skipped: map not initialized');
    return;
  }

  const zoom = map.getZoom();
  console.log(`🔍 Heatmap check: zoom=${zoom}, min=${HEATMAP_MIN_ZOOM}`);

  // Remove heatmap if zoom is too low
  if (zoom < HEATMAP_MIN_ZOOM) {
    if (heatmapLayer && map.hasLayer(heatmapLayer)) {
      map.removeLayer(heatmapLayer);
      console.log('📍 Population heatmap hidden (zoom < 10)');
    }
    return;
  }

  // Fetch cities in current viewport
  const bounds = map.getBounds();
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const west = bounds.getWest();

  console.log(`🌍 Fetching cities for bounds: N=${north.toFixed(2)}, S=${south.toFixed(2)}, E=${east.toFixed(2)}, W=${west.toFixed(2)}`);

  try {
    const response = await apiClient.getCitiesInViewport(north, south, east, west);
    console.log('📡 GeoNames response:', response);

    if (!response.cities || response.cities.length === 0) {
      console.warn('⚠ No cities found in viewport for heatmap');
      return;
    }

    // Convert city data to heatmap points [lat, lng, intensity]
    const heatData = response.cities.map(city => {
      // Normalize population to intensity (0-1)
      // Log scale for better visualization
      const intensity = Math.min(1, Math.log10(city.population + 1) / 7); // Max at 10M population
      return [city.lat, city.lng, intensity];
    });

    console.log(`🔥 Creating heatmap with ${heatData.length} points`);

    // Remove old heatmap if exists
    if (heatmapLayer && map.hasLayer(heatmapLayer)) {
      map.removeLayer(heatmapLayer);
    }

    // Create new heatmap layer
    heatmapLayer = L.heatLayer(heatData, {
      radius: 25,
      blur: 35,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.0: 'blue',
        0.3: 'cyan',
        0.5: 'lime',
        0.7: 'yellow',
        1.0: 'red'
      }
    }).addTo(map);

    console.log(`✅ Population heatmap updated with ${response.cities.length} cities`);
  } catch (error) {
    console.error('❌ Error updating population heatmap:', error);
    console.error('Error details:', error.message, error.stack);
  }
}

// Update all GIBS layers when the selected date changes
function updateGibsLayersForDate() {
  if (!map) return;

  Object.entries(LAYER_ID_TO_GIBS).forEach(([layerId, gibsId]) => {
    const config = GIBS_LAYERS[gibsId];
    if (!config) return;

    const date = resolveGIBSDate(config.dateFormat, mapStore.gibsDate);
    const existingLayer = gibsLayers.get(layerId);
    const wasActive = existingLayer ? map.hasLayer(existingLayer) : false;

    if (config.isVector) {
      if (existingLayer && map.hasLayer(existingLayer)) {
        map.removeLayer(existingLayer);
      }

      const mvtUrl = config.mvtUrl.replace('{date}', date);

      const vectorLayer = L.vectorGrid.protobuf(mvtUrl, {
        maxNativeZoom: config.maxZoom,
        maxZoom: 19,
        interactive: false,
        rendererFactory: L.canvas.tile,
        vectorTileLayerStyles: {
          'FIRMS_MODIS_Thermal_Anomalies': function(properties, zoom, geometryDimension) {
            if (geometryDimension === 1) {
              const frp = properties.FRP || 0;
              const confidence = properties.CONFIDENCE || 0;
              let fillColor = '#ff9900';
              if (frp > 200) fillColor = '#ff0000';
              else if (frp > 100) fillColor = '#ff3b30';
              return {
                radius: Math.min(3 + (frp / 100), 6),
                weight: 1,
                fillColor: fillColor,
                fillOpacity: confidence > 80 ? 0.9 : 0.7,
                color: '#ff0000',
                fill: true
              };
            }
            return {};
          }
        },
        getFeatureId: (feature) => {
          return feature.properties.id || feature.properties.fid || Math.random();
        },
        noWrap: true,
        bounds: L.latLngBounds(L.latLng(-85.051129, -180), L.latLng(85.051129, 180)),
      });

      vectorLayer.on('load', () => {
        console.log(`✓ MVT layer ${gibsId} reloaded for date ${date}`);
      });

      vectorLayer.on('tileerror', (e) => {
        console.warn(`⚠ MVT tile error for ${gibsId} (date ${date}):`, e);
      });

      vectorLayer._gibsMaxZoom = config.maxZoom;
      vectorLayer._gibsId = gibsId;
      gibsLayers.set(layerId, vectorLayer);
      if (wasActive) {
        vectorLayer.addTo(map);
      }
    } else {
      const newUrl = config.url.replace('{date}', date);
      if (existingLayer && typeof existingLayer.setUrl === 'function') {
        existingLayer.setUrl(newUrl);
        existingLayer._gibsId = gibsId;
        existingLayer._gibsMaxZoom = config.maxZoom;
        if (wasActive && !map.hasLayer(existingLayer)) {
          existingLayer.addTo(map);
        }
      } else {
        if (existingLayer && map.hasLayer(existingLayer)) {
          map.removeLayer(existingLayer);
        }
        const tileLayer = L.tileLayer(newUrl, {
          attribution: config.attribution,
          opacity: config.opacity,
          tileSize: config.tileSize,
          maxNativeZoom: config.maxZoom,
          maxZoom: 19,
          noWrap: true,
          bounds: L.latLngBounds(L.latLng(-85.051129, -180), L.latLng(85.051129, 180)),
          updateWhenIdle: true,
          detectRetina: true,
        });
        tileLayer._gibsMaxZoom = config.maxZoom;
        tileLayer._gibsId = gibsId;
        gibsLayers.set(layerId, tileLayer);
        if (wasActive) {
          tileLayer.addTo(map);
        }
      }
    }
  });
}

// React to date changes
watch(
  () => mapStore.gibsDate,
  () => {
    updateGibsLayersForDate();
  }
);

// Watch for layer toggles and add/remove NASA GIBS layers
watch(
  () => mapStore.activeLayers,
  (layers) => {
    if (!map) return;

    Object.entries(layers).forEach(([layerId, isActive]) => {
      const gibsLayer = gibsLayers.get(layerId);
      if (!gibsLayer) return;

      if (isActive && !map.hasLayer(gibsLayer)) {
        // Add layer to map
        gibsLayer.addTo(map);
        // Clamp zoom for vector layers with low max zoom to avoid 404s
        if (gibsLayer._gibsId === 'MODIS_Combined_Thermal_Anomalies_All' && map.getZoom() > (gibsLayer._gibsMaxZoom ?? 7)) {
          map.setZoom(gibsLayer._gibsMaxZoom ?? 7);
        }
        // Clamp zoom for raster LST to its native max as well
        if (gibsLayer._gibsId === 'MODIS_Aqua_Land_Surface_Temp_Day' && map.getZoom() > (gibsLayer._gibsMaxZoom ?? 7)) {
          map.setZoom(gibsLayer._gibsMaxZoom ?? 7);
        }
        // Clamp zoom for AOD (VIIRS NOAA-20) to avoid requesting tiles beyond native max
        if (gibsLayer._gibsId === 'VIIRS_NOAA20_Aerosol_Optical_Depth' && map.getZoom() > (gibsLayer._gibsMaxZoom ?? 9)) {
          map.setZoom(gibsLayer._gibsMaxZoom ?? 9);
        }
        // Clamp for newly added LST/BT31 layers (native Level 7)
        const level7Ids = new Set([
          'MODIS_Aqua_Land_Surface_Temp_Night',
          'MODIS_Terra_Land_Surface_Temp_Day',
          'MODIS_Terra_Land_Surface_Temp_Night',
          'MODIS_Aqua_Brightness_Temp_Band31_Day',
          'MODIS_Aqua_Brightness_Temp_Band31_Night',
          'MODIS_Terra_Brightness_Temp_Band31_Day',
          'MODIS_Terra_Brightness_Temp_Band31_Night',
        ]);
        if (level7Ids.has(gibsLayer._gibsId) && map.getZoom() > (gibsLayer._gibsMaxZoom ?? 7)) {
          map.setZoom(gibsLayer._gibsMaxZoom ?? 7);
        }
        // Generic safety clamp for any configured max
        if (typeof gibsLayer._gibsMaxZoom === 'number' && map.getZoom() > gibsLayer._gibsMaxZoom) {
          map.setZoom(gibsLayer._gibsMaxZoom);
        }
        console.log(`Added NASA GIBS layer: ${layerId}`);
      } else if (!isActive && map.hasLayer(gibsLayer)) {
        // Remove layer from map
        map.removeLayer(gibsLayer);
        console.log(`Removed NASA GIBS layer: ${layerId}`);
      }
    });
  },
  { deep: true }
);
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map-container"></div>
    <div v-if="mapStore.loading" class="loading-overlay">
      <div class="spinner"></div>
      <p>Loading data...</p>
    </div>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-container {
  width: 100%;
  height: 100%;
  z-index: 0;
}

.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.95);
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  text-align: center;
  z-index: 1000;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
