<script setup>
import { onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapStore } from '../stores/mapStore';
import { apiClient } from '../services/apiClient';
import { GIBS_LAYERS, LAYER_ID_TO_GIBS } from '../config/gibsLayers';
import { getGIBSDateByType } from '../utils/dateUtils';
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

// Store GIBS layer instances
const gibsLayers = new Map();

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
    const date = getGIBSDateByType(config.dateFormat);

    // Create layer (raster PNG vs vector MVT)
    if (config.isVector) {
      const mvtUrl = config.mvtUrl.replace('{date}', date);
      const vectorLayer = L.vectorGrid.protobuf(mvtUrl, {
        maxNativeZoom: config.maxZoom,
        maxZoom: 19,
        interactive: false,
        // Style all points uniformly; can be refined using feature.properties
        pointToLayer: (feature, latlng) =>
          L.circleMarker(latlng, {
            radius: 3,
            color: '#a40000',
            weight: 1,
            fillColor: '#ff3b30',
            fillOpacity: 0.9,
          }),
        vectorTileLayerStyles: {
          // Source-layer name from GIBS style JSON
          MODIS_Combined_Thermal_Anomalies_All_v6_NRT: {
            fill: true,
          },
        },
        rendererFactory: L.canvas.tile,
      });

      gibsLayers.set(layerId, vectorLayer);
    } else {
      // Raster tile fallback
      const tileLayer = L.tileLayer(config.url.replace('{date}', date), {
        attribution: config.attribution,
        opacity: config.opacity,
        tileSize: config.tileSize,
        maxNativeZoom: config.maxZoom,
        maxZoom: 19,
        detectRetina: true,
      });
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
});

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
