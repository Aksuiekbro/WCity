<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapStore } from '../stores/mapStore';
import { apiClient } from '../services/apiClient';
import { GIBS_LAYERS, LAYER_ID_TO_GIBS } from '../config/gibsLayers';
import { resolveGIBSDate } from '../utils/dateUtils';
import 'leaflet.vectorgrid';
import 'leaflet.heat';

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
const INFRA_MIN_ZOOM = 12; // Show hospitals/schools at zoom 12+

// Store GIBS layer instances
const gibsLayers = new Map();

// Store Infrastructure layer groups (hospitals, schools)
const infraLayerGroups = new Map();

// Store heatmap layer
let populationHeatmapLayer = null;

onMounted(() => {
  if (!mapContainer.value) return;

  // Initialize Leaflet map
  map = L.map(mapContainer.value).setView([40.7128, -74.006], 10); // NYC default

  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  // Initialize NASA GIBS and SEDAC layers (don't add to map yet)
  Object.entries(LAYER_ID_TO_GIBS).forEach(([layerId, gibsId]) => {
    const config = GIBS_LAYERS[gibsId];
    if (!config) return;

    // Handle ArcGIS tile layers (like NASA SEDAC population density)
    if (config.isArcGIS) {
      const arcgisLayer = L.tileLayer(config.arcgisUrl, {
        attribution: config.attribution,
        opacity: config.opacity,
        tileSize: config.tileSize,
        maxZoom: config.maxZoom,
        noWrap: false,
      });
      arcgisLayer._gibsId = gibsId;
      arcgisLayer._isArcGIS = true;
      gibsLayers.set(layerId, arcgisLayer);
      console.log(`✓ ArcGIS tile layer ${gibsId} initialized`);
      return;
    }

    // Handle heatmap layers (population density heatmap)
    if (config.isHeatmap) {
      console.log(`🔥 Heatmap layer ${gibsId} will be initialized on-demand`);
      // Heatmap layer will be created when toggled on
      gibsLayers.set(layerId, { _isHeatmap: true, _gibsId: gibsId, _config: config });
      return;
    }

    // Handle WMS layers
    if (config.isWMS) {
      console.log(`🔧 Initializing WMS layer: ${gibsId}`, {
        url: config.wmsUrl,
        layers: config.wmsLayers,
        version: config.version
      });

      const wmsLayer = L.tileLayer.wms(config.wmsUrl, {
        layers: config.wmsLayers,
        format: config.format,
        transparent: config.transparent,
        opacity: config.opacity,
        version: config.version,
        attribution: config.attribution,
        maxZoom: 19,
      });

      wmsLayer._gibsId = gibsId;
      wmsLayer._isWMS = true;
      gibsLayers.set(layerId, wmsLayer);
      console.log(`✓ WMS layer ${gibsId} initialized successfully`);
      return;
    }

    // Get appropriate date for this layer type (GIBS layers only)
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

  // Handle zoom changes for infrastructure visibility
  map.on('zoomend', () => {
    updateVisibleInfrastructure();
  });

  // Handle map movement to update infrastructure
  map.on('moveend', () => {
    updateVisibleInfrastructure();
  });
});

function handleWindowResize() {
  if (map) {
    map.invalidateSize();
  }
}

// Ensure Leaflet recalculates size after container resizes (e.g., sidebar drag)
window.addEventListener('resize', handleWindowResize);

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize);
});

// Population heatmap functionality removed to prevent GeoNames API rate limiting
// Population density data is still available when clicking individual points on the map

// Create or retrieve an infrastructure layer group for a given type
function getOrCreateInfraGroup(type) {
  if (infraLayerGroups.has(type)) {
    return infraLayerGroups.get(type);
  }
  const group = L.layerGroup();
  infraLayerGroups.set(type, group);
  return group;
}

// Fetch and render hospitals or schools for current viewport
async function updateInfrastructureLayer(type) {
  if (!map) return;

  const zoom = map.getZoom();
  if (zoom < INFRA_MIN_ZOOM) {
    const group = getOrCreateInfraGroup(type);
    if (map.hasLayer(group)) {
      map.removeLayer(group);
    }
    group.clearLayers();
    return;
  }

  const bounds = map.getBounds();
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const west = bounds.getWest();

  try {
    const response = await apiClient.getInfrastructureInViewport(type, north, south, east, west);
    const group = getOrCreateInfraGroup(type);

    // Clear previous markers
    group.clearLayers();

    const isHospital = type === 'hospitals';
    const color = isHospital ? '#e74c3c' : '#3498db';
    const emoji = isHospital ? '🏥' : '🏫';

    (response.pois || []).forEach((poi) => {
      if (typeof poi.lat !== 'number' || typeof poi.lng !== 'number') return;
      const marker = L.circleMarker([poi.lat, poi.lng], {
        radius: 6,
        weight: 1,
        color: color,
        fillColor: color,
        fillOpacity: 0.85,
      });
      marker.bindPopup(`<strong>${emoji} ${poi.name}</strong><br/>${isHospital ? 'Hospital' : 'School'}`);
      group.addLayer(marker);
    });

    if (!map.hasLayer(group)) {
      group.addTo(map);
    }
  } catch (error) {
    console.error(`❌ Error updating ${type}:`, error);
  }
}

function updateVisibleInfrastructure() {
  if (mapStore.activeLayers.hospitals) {
    updateInfrastructureLayer('hospitals');
  }
  if (mapStore.activeLayers.schools) {
    updateInfrastructureLayer('schools');
  }
}

// Fetch and create population heatmap
async function createPopulationHeatmap() {
  if (populationHeatmapLayer) return populationHeatmapLayer;

  try {
    console.log('🔥 Fetching population data for heatmap...');

    // Sample major cities with population (you can expand this or fetch from API)
    const cityData = [
      // North America
      [40.7128, -74.0060, 8.3],  // New York
      [34.0522, -118.2437, 3.9], // Los Angeles
      [41.8781, -87.6298, 2.7],  // Chicago
      [29.7604, -95.3698, 2.3],  // Houston
      [33.4484, -112.0740, 1.6], // Phoenix
      [39.9526, -75.1652, 1.6],  // Philadelphia
      [29.4241, -98.4936, 1.5],  // San Antonio
      [32.7767, -96.7970, 1.3],  // Dallas
      [37.3382, -121.8863, 1.0], // San Jose
      [30.2672, -97.7431, 0.96], // Austin
      [19.4326, -99.1332, 9.2],  // Mexico City
      [25.6866, -100.3161, 5.3], // Monterrey
      [43.6532, -79.3832, 2.9],  // Toronto
      [45.5017, -73.5673, 1.7],  // Montreal
      [49.2827, -123.1207, 0.7], // Vancouver

      // South America
      [-23.5505, -46.6333, 12.3], // São Paulo
      [-34.6037, -58.3816, 15.2], // Buenos Aires
      [-22.9068, -43.1729, 6.7],  // Rio de Janeiro
      [-33.4489, -70.6693, 5.6],  // Santiago
      [4.7110, -74.0721, 7.4],    // Bogotá
      [-12.0464, -77.0428, 9.7],  // Lima

      // Europe
      [51.5074, -0.1278, 9.0],    // London
      [48.8566, 2.3522, 2.2],     // Paris
      [52.5200, 13.4050, 3.6],    // Berlin
      [41.9028, 12.4964, 2.8],    // Rome
      [40.4168, -3.7038, 3.2],    // Madrid
      [55.7558, 37.6173, 12.5],   // Moscow
      [59.9343, 30.3351, 5.4],    // Saint Petersburg
      [50.0755, 14.4378, 1.3],    // Prague
      [52.2297, 21.0122, 1.8],    // Warsaw
      [53.3498, -6.2603, 1.2],    // Dublin

      // Asia
      [35.6762, 139.6503, 14.0],  // Tokyo
      [28.7041, 77.1025, 32.9],   // Delhi
      [31.2304, 121.4737, 27.0],  // Shanghai
      [19.0760, 72.8777, 20.4],   // Mumbai
      [39.9042, 116.4074, 21.5],  // Beijing
      [22.5726, 88.3639, 15.0],   // Kolkata
      [30.5728, 114.2942, 11.1],  // Wuhan
      [23.1291, 113.2644, 15.3],  // Guangzhou
      [34.6937, 135.5023, 19.2],  // Osaka
      [22.3193, 114.1694, 7.5],   // Hong Kong
      [37.5665, 126.9780, 9.8],   // Seoul
      [-6.2088, 106.8456, 10.6],  // Jakarta
      [13.7563, 100.5018, 10.5],  // Bangkok
      [1.3521, 103.8198, 5.7],    // Singapore
      [25.0330, 121.5654, 2.7],   // Taipei
      [23.8103, 90.4125, 21.0],   // Dhaka
      [33.3152, 44.3661, 7.2],    // Baghdad
      [35.6892, 51.3890, 9.0],    // Tehran
      [24.8607, 67.0011, 16.0],   // Karachi
      [31.5497, 74.3436, 13.0],   // Lahore

      // Africa
      [30.0444, 31.2357, 20.9],   // Cairo
      [-26.2041, 28.0473, 5.6],   // Johannesburg
      [6.5244, 3.3792, 14.8],     // Lagos
      [-1.2921, 36.8219, 4.4],    // Nairobi
      [33.5731, -7.5898, 3.7],    // Casablanca
      [-4.4419, 15.2663, 14.3],   // Kinshasa
      [9.0320, 38.7469, 5.0],     // Addis Ababa

      // Oceania
      [-33.8688, 151.2093, 5.3],  // Sydney
      [-37.8136, 144.9631, 5.0],  // Melbourne
      [-27.4698, 153.0251, 2.5],  // Brisbane
      [-31.9505, 115.8605, 2.1],  // Perth
      [-41.2865, 174.7762, 0.4],  // Wellington
    ];

    // Normalize intensity values (max population is ~33 million for Delhi)
    const maxPop = 33;
    const normalizedData = cityData.map(([lat, lng, pop]) => [
      lat,
      lng,
      pop / maxPop  // Normalize to 0-1 range
    ]);

    // Create heatmap layer with normalized city population data
    populationHeatmapLayer = L.heatLayer(normalizedData, {
      radius: 25,              // Radius of each point
      blur: 20,                // Blur amount
      maxZoom: 18,             // Show at all zoom levels
      max: 1.0,                // Maximum intensity value
      minOpacity: 0.3,         // Minimum opacity to ensure all cities are visible
      gradient: {
        0.0: '#440154',
        0.2: '#3b528b',
        0.4: '#21918c',
        0.6: '#5ec962',
        0.8: '#fde725',
        1.0: '#ff0000'
      }
    });

    console.log('✓ Population heatmap created successfully');
    return populationHeatmapLayer;
  } catch (error) {
    console.error('❌ Error creating population heatmap:', error);
    return null;
  }
}

// Update all GIBS layers when the selected date changes
function updateGibsLayersForDate() {
  if (!map) return;

  Object.entries(LAYER_ID_TO_GIBS).forEach(([layerId, gibsId]) => {
    const config = GIBS_LAYERS[gibsId];
    if (!config) return;

    // Skip WMS and ArcGIS layers (they don't have date-based tiles)
    if (config.isWMS || config.isArcGIS) {
      return;
    }

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
      // Handle infrastructure toggles
      if (layerId === 'hospitals' || layerId === 'schools') {
        const group = getOrCreateInfraGroup(layerId);
        if (isActive) {
          if (!map.hasLayer(group)) {
            group.addTo(map);
          }
          updateInfrastructureLayer(layerId);
        } else {
          if (map.hasLayer(group)) {
            map.removeLayer(group);
          }
          group.clearLayers();
        }
        return;
      }

      const gibsLayer = gibsLayers.get(layerId);
      if (!gibsLayer) return;

      // Handle heatmap layer
      if (gibsLayer._isHeatmap) {
        if (isActive) {
          createPopulationHeatmap().then(heatmap => {
            if (heatmap && !map.hasLayer(heatmap)) {
              heatmap.addTo(map);
              console.log('✓ Added population heatmap layer');
            }
          });
        } else {
          if (populationHeatmapLayer && map.hasLayer(populationHeatmapLayer)) {
            map.removeLayer(populationHeatmapLayer);
            console.log('Removed population heatmap layer');
          }
        }
        return;
      }

      if (isActive && !map.hasLayer(gibsLayer)) {
        // Add layer to map
        gibsLayer.addTo(map);

        // Skip zoom clamping for WMS/ArcGIS layers (they support all zoom levels)
        if (gibsLayer._isWMS || gibsLayer._isArcGIS) {
          console.log(`✓ Added tile layer: ${layerId}`);
          return;
        }

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
