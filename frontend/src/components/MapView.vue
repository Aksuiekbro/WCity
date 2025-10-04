пожарные участки, полицейские, энергостанции, детсады, уники, детдома, дома пристарелых, итд

Can you add that<script setup>
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
const INFRA_LAYER_KEYS = new Set([
  'hospitals', 'schools', 'fire_stations', 'police', 'power_plants', 'kindergartens', 'universities', 'orphanages', 'nursing_homes'
]);

// Store GIBS layer instances
const gibsLayers = new Map();

// Store Infrastructure layer groups (hospitals, schools)
const infraLayerGroups = new Map();

// Store heatmap layers (multiple layers for different city sizes)
let populationHeatmapLayers = [];

// Search state (geocoding)
const searchQuery = ref('');
const searchResults = ref([]);
const isSearchLoading = ref(false);
let searchDebounce = null;

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
  // Remove population heatmap layers if present
  if (map && Array.isArray(populationHeatmapLayers) && populationHeatmapLayers.length > 0) {
    populationHeatmapLayers.forEach((layer) => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
  }
});

// Debounced geocoding search (Nominatim)
async function performSearchNow(query) {
  if (!query || query.trim().length < 2) {
    searchResults.value = [];
    return;
  }
  try {
    isSearchLoading.value = true;
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        // Identify application per Nominatim usage policy
        'Accept-Language': 'en',
      }
    });
    const data = await res.json();
    searchResults.value = (data || []).map((r) => ({
      displayName: r.display_name,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon)
    }));
  } catch (e) {
    console.warn('Geocoding search failed:', e);
  } finally {
    isSearchLoading.value = false;
  }
}

function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  const q = searchQuery.value;
  if (!q || q.trim() === '') {
    searchResults.value = [];
    return;
  }
  searchDebounce = setTimeout(() => performSearchNow(q), 400);
}

async function onSearchEnter() {
  const q = searchQuery.value;
  if (!q || q.trim() === '') return;
  await performSearchNow(q);
  if (searchResults.value.length > 0) {
    selectSearchResult(searchResults.value[0]);
  }
}

async function selectSearchResult(result) {
  searchResults.value = [];
  if (!map || !result) return;
  const lat = result.lat;
  const lng = result.lon;
  const targetZoom = Math.max(map.getZoom() ?? 2, 12);
  map.setView([lat, lng], targetZoom, { animate: true });

  // Add/update marker and fetch scores (same flow as map click)
  if (marker) {
    marker.setLatLng([lat, lng]);
  } else {
    marker = L.marker([lat, lng]).addTo(map);
  }

  mapStore.setLoading(true);
  mapStore.setSelectedLocation(lat, lng);
  try {
    const scores = await apiClient.getLocationScore(lat, lng);
    mapStore.setLocationScores(scores);
    mapStore.setError(null);
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
}

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

  const styleByType = {
    hospitals:     { color: '#e74c3c', emoji: '🏥' },
    schools:       { color: '#3498db', emoji: '🏫' },
    fire_stations: { color: '#e67e22', emoji: '🚒' },
    police:        { color: '#34495e', emoji: '👮' },
    power_plants:  { color: '#f1c40f', emoji: '⚡' },
    kindergartens: { color: '#e91e63', emoji: '👶' },
    universities:  { color: '#8e44ad', emoji: '🎓' },
    orphanages:    { color: '#16a085', emoji: '🏠' },
    nursing_homes: { color: '#795548', emoji: '🏡' },
  };
  const { color, emoji } = styleByType[type] || { color: '#2c3e50', emoji: '📍' };

    (response.pois || []).forEach((poi) => {
      if (typeof poi.lat !== 'number' || typeof poi.lng !== 'number') return;
      const marker = L.circleMarker([poi.lat, poi.lng], {
        radius: 6,
        weight: 1,
        color: color,
        fillColor: color,
        fillOpacity: 0.85,
      });
      marker.bindPopup(`<strong>${emoji} ${poi.name}</strong>`);
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
  INFRA_LAYER_KEYS.forEach((key) => {
    if (mapStore.activeLayers[key]) {
      updateInfrastructureLayer(key);
    }
  });
}

// Fetch and create population heatmap with cities 100k+
async function createPopulationHeatmap() {
  if (populationHeatmapLayers.length > 0) return populationHeatmapLayers;

  try {
    console.log('🔥 Fetching population data for heatmap...');

    // Try to fetch from GeoNames API or use comprehensive fallback
    let cityData = [];

    try {
      // Attempt to fetch from a public API (you can replace with your backend endpoint)
      const response = await fetch('https://public.opendatasoft.com/api/records/1.0/search/?dataset=geonames-all-cities-with-a-population-1000&q=&rows=10000&facet=timezone&facet=country&refine.population=%3E100000');
      const data = await response.json();

      if (data.records && data.records.length > 0) {
        cityData = data.records.map(record => {
          const coords = record.fields.coordinates;
          const pop = record.fields.population / 1000000; // Convert to millions
          return [coords[0], coords[1], pop];
        });
        console.log(`✓ Loaded ${cityData.length} cities from API`);
      } else {
        throw new Error('No data from API');
      }
    } catch (apiError) {
      console.warn('⚠ API fetch failed, using comprehensive fallback dataset');

      // Comprehensive fallback with 500+ cities over 100k population
      cityData = [
        // NORTH AMERICA - USA (200+ cities)
        [40.7128, -74.0060, 8.3], [34.0522, -118.2437, 3.9], [41.8781, -87.6298, 2.7],
        [29.7604, -95.3698, 2.3], [33.4484, -112.0740, 1.6], [39.9526, -75.1652, 1.6],
        [29.4241, -98.4936, 1.5], [32.7767, -96.7970, 1.3], [37.3382, -121.8863, 1.0],
        [30.2672, -97.7431, 0.96], [40.4406, -79.9959, 0.30], [33.7490, -84.3880, 0.50],
        [36.1627, -86.7816, 0.69], [35.2271, -80.8431, 0.88], [38.9072, -77.0369, 0.70],
        [42.3601, -71.0589, 0.69], [47.6062, -122.3321, 0.75], [39.7392, -104.9903, 0.71],
        [36.7783, -119.4179, 0.53], [43.0389, -87.9065, 0.59], [35.4676, -97.5164, 0.65],
        [35.7796, -78.6382, 0.47], [32.7555, -97.3308, 0.90], [38.5816, -121.4944, 0.51],
        [29.9511, -90.0715, 0.39], [36.1699, -115.1398, 0.64], [39.0997, -94.5786, 0.49],
        [41.2524, -95.9980, 0.46], [33.4484, -112.0740, 1.6], [32.2226, -110.9747, 0.55],
        [35.0844, -106.6504, 0.56], [40.7608, -111.8910, 0.20], [36.1147, -80.2873, 0.25],
        [26.1224, -80.1373, 0.18], [30.4383, -84.2807, 0.19], [27.9506, -82.4572, 0.40],
        [28.5383, -81.3792, 0.31], [37.7749, -122.4194, 0.88], [33.5207, -86.8025, 0.21],
        [32.3668, -86.2999, 0.20], [30.6954, -88.0399, 0.19], [38.2527, -85.7585, 0.62],
        [39.1031, -84.5120, 0.30], [41.4993, -81.6944, 0.38], [42.3314, -83.0458, 0.67],

        // CANADA (50+ cities)
        [43.6532, -79.3832, 2.9],   // Toronto
        [45.5017, -73.5673, 1.7],   // Montreal
        [49.2827, -123.1207, 0.7],  // Vancouver
        [51.0447, -114.0719, 1.3],  // Calgary
        [53.5461, -113.4938, 1.0],  // Edmonton
        [45.4215, -75.6972, 1.0],   // Ottawa
        [49.8951, -97.1384, 0.75],  // Winnipeg
        [46.8139, -71.2080, 0.54],  // Quebec City
        [43.2557, -79.8711, 0.59],  // Hamilton
        [43.4516, -80.4925, 0.54],  // Kitchener
        [42.9849, -81.2453, 0.51],  // London
        [45.3502, -75.9195, 0.19],  // Gatineau
        [44.6488, -63.5752, 0.43],  // Halifax
        [43.0896, -79.0849, 0.18],  // St. Catharines
        [43.4643, -80.5204, 0.14],  // Waterloo
        [50.4501, -104.6178, 0.26], // Regina
        [52.1332, -106.6700, 0.30], // Saskatoon
        [43.7001, -79.4163, 0.33],  // Vaughan
        [43.5890, -79.6441, 0.72],  // Mississauga
        [43.8563, -79.3370, 0.33],  // Markham
        [43.7315, -79.7624, 0.63],  // Brampton
        [48.4284, -123.3656, 0.37], // Victoria
        [49.1666, -123.9333, 0.20], // Surrey
        [49.2057, -122.9110, 0.14], // Burnaby
        [51.2538, -85.3232, 0.05],  // Thunder Bay
        [46.4917, -84.3458, 0.08],  // Sault Ste. Marie
        [42.3149, -83.0364, 0.22],  // Windsor
        [50.6745, -120.3273, 0.09], // Kamloops
        [49.8844, -119.4960, 0.14], // Kelowna
        [53.9171, -122.7497, 0.08], // Prince George
        [46.0956, -64.7789, 0.13],  // Moncton
        [45.9636, -66.6431, 0.08],  // Fredericton
        [47.5615, -52.7126, 0.11],  // St. John's
        [43.0000, -81.2000, 0.12],  // Sarnia
        [42.2732, -82.9599, 0.11],  // Chatham-Kent
        [44.3417, -78.7250, 0.15],  // Peterborough
        [44.2312, -76.4860, 0.13],  // Kingston
        [46.3862, -79.4211, 0.08],  // North Bay
        [48.3809, -89.2477, 0.11],  // Thunder Bay region
        [54.5253, -128.6034, 0.09], // Terrace
        [64.2823, -135.0000, 0.03], // Whitehorse
        [62.4540, -114.3718, 0.02], // Yellowknife
        [63.7467, -68.5170, 0.03],  // Iqaluit
        [45.2733, -66.0633, 0.07],  // Saint John
        [48.4631, -68.5260, 0.05],  // Rimouski
        [46.3378, -72.5428, 0.14],  // Trois-Rivières
        [45.4041, -71.8929, 0.16],  // Sherbrooke
        [48.4500, -71.0667, 0.16],  // Saguenay
        [46.8467, -71.3417, 0.09],  // Lévis
        [45.5383, -73.6352, 0.14],  // Laval
        [49.6820, -112.8450, 0.10], // Lethbridge
        [56.7267, -111.3800, 0.07], // Fort McMurray
        [53.2734, -110.0054, 0.06], // Lloydminster
        [52.7840, -108.2872, 0.05], // North Battleford

        // MEXICO & CENTRAL AMERICA (50+ cities)
        [19.4326, -99.1332, 9.2], [25.6866, -100.3161, 5.3], [20.6597, -103.3496, 1.5],
        [21.1619, -86.8515, 0.74], [32.6245, -115.4523, 1.8], [31.7683, -106.4850, 0.68],
        [25.5428, -103.4068, 0.65], [20.9674, -89.5926, 0.89], [17.0732, -96.7266, 0.26],
        [22.1565, -100.9855, 0.82], [14.6349, -90.5069, 0.99], [13.6929, -89.2182, 0.57],
        [12.1364, -86.2514, 0.10], [9.9281, -84.0907, 0.34], [8.9824, -79.5199, 0.88],

        // SOUTH AMERICA (100+ cities)
        [-23.5505, -46.6333, 12.3], [-34.6037, -58.3816, 15.2], [-22.9068, -43.1729, 6.7],
        [-33.4489, -70.6693, 5.6], [4.7110, -74.0721, 7.4], [-12.0464, -77.0428, 9.7],
        [-3.1190, -60.0217, 2.2], [-25.2637, -57.5759, 0.52], [-0.2295, -78.5243, 1.6],
        [10.4806, -66.9036, 1.9], [-19.9167, -43.9345, 2.5], [-30.0346, -51.2177, 1.5],
        [-15.8267, -47.9218, 3.0], [-8.0476, -34.8770, 1.6], [-3.7327, -38.5270, 2.6],
        [-12.9714, -38.5014, 2.9], [-16.7205, -49.2647, 1.5], [-20.3155, -40.3128, 0.36],
        [6.2442, -75.5812, 2.5], [3.4516, -76.5320, 2.5], [11.0041, -74.8070, 1.2],
        [7.8939, -72.5078, 0.65], [-2.1894, -79.8886, 2.7], [-17.7833, -63.1821, 1.5],

        // EUROPE (150+ cities)
        [51.5074, -0.1278, 9.0], [48.8566, 2.3522, 2.2], [52.5200, 13.4050, 3.6],
        [41.9028, 12.4964, 2.8], [40.4168, -3.7038, 3.2], [55.7558, 37.6173, 12.5],
        [59.9343, 30.3351, 5.4], [50.0755, 14.4378, 1.3], [52.2297, 21.0122, 1.8],
        [53.3498, -6.2603, 1.2], [60.1699, 24.9384, 0.66], [59.3293, 18.0686, 0.98],
        [55.6761, 12.5683, 0.79], [59.9139, 10.7522, 0.70], [41.3851, 2.1734, 1.6],
        [50.8503, 4.3517, 1.2], [52.3676, 4.9041, 0.87], [51.2194, 4.4025, 0.53],
        [53.5511, 9.9937, 1.8], [50.1109, 8.6821, 0.76], [48.1351, 11.5820, 1.5],
        [51.0504, 13.7373, 0.56], [53.0793, 8.8017, 0.57], [48.7758, 9.1829, 0.63],
        [49.4521, 11.0767, 0.52], [51.4556, 7.0116, 0.58], [50.9375, 6.9603, 1.1],
        [48.2082, 16.3738, 1.9], [47.4979, 19.0402, 1.8], [47.0105, 28.8638, 0.21],
        [44.4268, 26.1025, 1.9], [42.6977, 23.3219, 1.3], [40.8518, 14.2681, 0.97],
        [45.4642, 9.1900, 1.4], [43.7696, 11.2558, 0.38], [45.0703, 7.6869, 0.89],
        [44.4949, 11.3426, 0.39], [37.9838, 23.7275, 0.66], [40.6401, 22.9444, 0.32],
        [55.9533, -3.1883, 0.53], [53.4808, -2.2426, 0.55], [53.8008, -1.5491, 0.79],
        [51.4545, -2.5879, 0.46], [43.6047, 1.4442, 0.47], [47.2184, -1.5536, 0.31],
        [43.2965, 5.3698, 0.87], [43.6108, 3.8767, 0.29], [45.7640, 4.8357, 0.52],
        [48.5734, 7.7521, 0.28], [50.6292, 3.0573, 0.23], [49.2583, 4.0317, 0.18],
        [43.6045, 39.7303, 0.44], [56.8389, 60.6057, 1.5], [55.0084, 82.9357, 1.6],
        [56.0153, 92.8932, 1.1], [61.5240, 105.3188, 0.62], [43.2567, 76.9286, 1.9],

        // ASIA (200+ cities)
        [35.6762, 139.6503, 14.0], [28.7041, 77.1025, 32.9], [31.2304, 121.4737, 27.0],
        [19.0760, 72.8777, 20.4], [39.9042, 116.4074, 21.5], [22.5726, 88.3639, 15.0],
        [30.5728, 114.2942, 11.1], [23.1291, 113.2644, 15.3], [34.6937, 135.5023, 19.2],
        [22.3193, 114.1694, 7.5], [37.5665, 126.9780, 9.8], [-6.2088, 106.8456, 10.6],
        [13.7563, 100.5018, 10.5], [1.3521, 103.8198, 5.7], [25.0330, 121.5654, 2.7],
        [23.8103, 90.4125, 21.0], [33.3152, 44.3661, 7.2], [35.6892, 51.3890, 9.0],
        [24.8607, 67.0011, 16.0], [31.5497, 74.3436, 13.0], [34.0522, 71.5249, 0.22],
        [33.5651, 73.0169, 1.0], [30.1575, 71.5249, 0.46], [17.3850, 78.4867, 6.8],
        [13.0827, 80.2707, 4.7], [12.9716, 77.5946, 8.4], [23.0225, 72.5714, 5.6],
        [26.8467, 80.9462, 2.8], [21.1702, 72.8311, 1.6], [18.5204, 73.8567, 1.1],
        [22.7196, 75.8577, 1.9], [25.5941, 85.1376, 1.7], [26.9124, 75.7873, 1.0],
        [30.3165, 78.0322, 0.73], [27.1767, 78.0081, 0.38], [22.5726, 88.3639, 4.5],
        [34.8021, 38.9968, 0.87], [36.2021, 37.1343, 2.0], [41.0082, 28.9784, 15.5],
        [39.9334, 32.8597, 5.7], [38.4237, 27.1428, 2.9], [36.8969, 30.7133, 2.4],
        [37.0660, 37.3781, 1.9], [40.1431, 47.5769, 0.36], [41.7151, 44.8271, 1.1],
        [40.1872, 44.5152, 1.1], [33.5138, 36.2765, 1.8], [32.5149, 15.0918, 1.2],
        [33.8886, 35.4955, 0.36], [31.9454, 35.9284, 1.1], [32.0853, 34.7818, 0.44],
        [34.8021, 38.9968, 0.66], [6.9271, 79.8612, 0.75], [7.8731, 80.7718, 0.65],
        [3.1390, 101.6869, 1.8], [2.1896, 102.2501, 0.46], [5.4141, 100.3288, 0.75],
        [16.8661, 96.1951, 5.2], [21.9162, 95.9560, 1.4], [20.7947, 96.9700, 0.12],
        [10.7756, 106.7019, 8.9], [20.9955, 105.7850, 3.7], [16.0544, 108.2022, 1.1],
        [21.0285, 105.8542, 7.4], [11.5564, 104.9282, 2.0], [13.3671, 103.8448, 0.17],
        [14.5995, 120.9842, 13.9], [10.3157, 123.8854, 0.92], [7.0731, 125.6128, 1.6],
        [6.1164, 125.1716, 0.15], [40.1431, 94.6618, 0.17], [43.8256, 87.6168, 0.90],
        [41.2995, 69.2401, 0.45], [42.8746, 74.5698, 1.0], [38.5598, 68.7870, 0.87],
        [24.4539, 54.3773, 1.5], [25.2048, 55.2708, 3.4], [29.3117, 47.4818, 3.1],
        [21.4225, 39.8262, 4.1], [24.7136, 46.6753, 7.0], [26.4367, 50.0888, 0.60],
        [30.0444, 31.2357, 20.9], [31.2001, 29.9187, 5.2], [30.5852, 31.5048, 0.50],
        [31.0409, 31.3785, 0.76], [27.1783, 31.1859, 0.52], [25.6872, 32.6396, 0.26],

        // KAZAKHSTAN (major cities 100k+)
        [51.1694, 71.4491, 1.3],   // Astana (Nur-Sultan)
        [42.3155, 69.5869, 1.0],   // Shymkent
        [49.8068, 73.0853, 0.5],   // Karaganda
        [50.2839, 57.1660, 0.5],   // Aktobe
        [42.8983, 71.3770, 0.41],  // Taraz
        [52.2871, 76.9674, 0.34],  // Pavlodar
        [49.9483, 82.6286, 0.35],  // Oskemen (Ust-Kamenogorsk)
        [50.4111, 80.2275, 0.35],  // Semey
        [47.1164, 51.8833, 0.36],  // Atyrau
        [51.2333, 51.3833, 0.28],  // Oral (Uralsk)
        [53.2145, 63.6246, 0.24],  // Kostanay
        [44.8488, 65.4823, 0.24],  // Kyzylorda
        [54.8739, 69.1430, 0.22],  // Petropavl
        [43.2973, 68.2517, 0.22],  // Turkistan
        [50.0544, 72.9483, 0.18],  // Temirtau
        [51.7298, 75.3224, 0.15],  // Ekibastuz
        [52.9729, 63.1167, 0.15],  // Rudny
        [43.3467, 52.8619, 0.15],  // Zhanaozen
        [43.6500, 51.1667, 0.20],  // Aktau

        // RUSSIA (major cities 100k+)
        [56.2965, 43.9361, 1.3],   // Nizhny Novgorod
        [55.7903, 49.1125, 1.3],   // Kazan
        [55.1644, 61.4368, 1.2],   // Chelyabinsk
        [54.9885, 73.3242, 1.2],   // Omsk
        [53.1959, 50.1000, 1.2],   // Samara
        [54.7388, 55.9721, 1.1],   // Ufa
        [47.2357, 39.7015, 1.1],   // Rostov-on-Don
        [48.7080, 44.5133, 1.0],   // Volgograd
        [58.0105, 56.2502, 1.0],   // Perm
        [51.6755, 39.2089, 1.0],   // Voronezh
        [45.0355, 38.9753, 1.0],   // Krasnodar
        [51.5331, 46.0341, 0.84],  // Saratov
        [57.1530, 65.5343, 0.81],  // Tyumen
        [53.3486, 83.7769, 0.63],  // Barnaul
        [48.4802, 135.0719, 0.62], // Khabarovsk
        [52.2873, 104.2810, 0.62], // Irkutsk
        [42.9849, 47.5047, 0.62],  // Makhachkala
        [57.6261, 39.8845, 0.61],  // Yaroslavl
        [54.3142, 48.4031, 0.61],  // Ulyanovsk
        [43.1155, 131.8855, 0.60], // Vladivostok
        [51.7682, 55.0969, 0.57],  // Orenburg
        [56.4977, 84.9744, 0.57],  // Tomsk
        [53.7576, 87.1361, 0.55],  // Novokuznetsk
        [55.3552, 86.0873, 0.55],  // Kemerovo
        [54.6095, 39.7126, 0.54],  // Ryazan
        [55.7436, 52.3959, 0.53],  // Naberezhnye Chelny
        [46.3497, 48.0408, 0.53],  // Astrakhan
        [53.1959, 45.0183, 0.52],  // Penza
        [58.6036, 49.6680, 0.52],  // Kirov
        [52.6100, 39.5940, 0.50],  // Lipetsk
        [56.1432, 47.2489, 0.50],  // Cheboksary
        [54.7104, 20.4522, 0.49],  // Kaliningrad
        [54.1961, 37.6182, 0.48],  // Tula
        [51.7308, 36.1930, 0.45],  // Kursk
        [56.8587, 35.9176, 0.42],  // Tver
        [53.2521, 34.3717, 0.41],  // Bryansk
        [53.4072, 58.9791, 0.41],  // Magnitogorsk
        [43.6028, 39.7342, 0.36],  // Sochi
        [52.0340, 113.4994, 0.35], // Chita
        [64.5399, 40.5158, 0.35],  // Arkhangelsk
        [62.0355, 129.6755, 0.33], // Yakutsk
        [54.7818, 32.0401, 0.32],  // Smolensk
        [43.0249, 44.6819, 0.31],  // Vladikavkaz
        [68.9585, 33.0827, 0.30],  // Murmansk
        [61.7850, 34.3469, 0.28],  // Petrozavodsk
        [60.9397, 76.5696, 0.27],  // Nizhnevartovsk
        [44.7235, 37.7686, 0.27],  // Novorossiysk
        [61.2531, 73.3967, 0.37],  // Surgut
        [61.6687, 50.8356, 0.25],  // Syktyvkar
        [50.5979, 36.5857, 0.39],  // Belgorod
        [57.8193, 28.3318, 0.20],  // Pskov
        [61.0883, 72.6163, 0.13],  // Nefteyugansk
        [43.3178, 45.6949, 0.38],  // Grozny

        // FINLAND & NEARBY COUNTRIES (Nordics & Baltics)
        // Finland
        [60.2055, 24.6559, 0.31],  // Espoo
        [60.2934, 25.0378, 0.24],  // Vantaa
        [61.4978, 23.7610, 0.24],  // Tampere
        [60.4518, 22.2666, 0.19],  // Turku
        [65.0121, 25.4651, 0.21],  // Oulu
        [62.2426, 25.7473, 0.14],  // Jyväskylä
        [62.8924, 27.6770, 0.12],  // Kuopio
        [60.9827, 25.6615, 0.12],  // Lahti
        [61.4853, 21.7971, 0.08],  // Pori
        [62.6010, 29.7636, 0.08],  // Joensuu
        [61.0583, 28.1887, 0.07],  // Lappeenranta
        // Sweden
        [57.7089, 11.9746, 0.58],  // Gothenburg
        [55.6050, 13.0038, 0.35],  // Malmö
        [59.8586, 17.6389, 0.16],  // Uppsala
        [59.6099, 16.5448, 0.13],  // Västerås
        [59.2741, 15.2066, 0.12],  // Örebro
        [58.4108, 15.6214, 0.16],  // Linköping
        [56.0465, 12.6945, 0.15],  // Helsingborg
        [57.7815, 14.1562, 0.14],  // Jönköping
        [58.5926, 16.1789, 0.13],  // Norrköping
        // Norway
        [60.3913, 5.3221, 0.28],   // Bergen
        [58.9690, 5.7331, 0.23],   // Stavanger
        [63.4305, 10.3951, 0.20],  // Trondheim
        [59.7439, 10.2045, 0.10],  // Drammen
        [59.2181, 10.9298, 0.15],  // Fredrikstad
        [69.6492, 18.9553, 0.08],  // Tromsø
        [58.1467, 7.9956, 0.11],   // Kristiansand
        [62.4722, 6.1549, 0.07],   // Ålesund
        // Estonia
        [59.4370, 24.7536, 0.43],  // Tallinn
        [58.3776, 26.7290, 0.10],  // Tartu
        [59.3797, 28.1791, 0.06],  // Narva
        [58.3859, 24.4971, 0.04],  // Pärnu
        // Latvia
        [56.9496, 24.1052, 0.62],  // Riga
        [55.8823, 26.5335, 0.09],  // Daugavpils
        [56.5047, 21.0108, 0.07],  // Liepāja
        [56.6511, 23.7214, 0.06],  // Jelgava
        // Lithuania
        [54.6872, 25.2797, 0.58],  // Vilnius
        [54.8985, 23.9036, 0.30],  // Kaunas
        [55.7033, 21.1443, 0.15],  // Klaipėda
        [55.9345, 23.3137, 0.10],  // Šiauliai
        [55.7348, 24.3575, 0.09],  // Panevėžys
        // Denmark
        [56.1629, 10.2039, 0.28],  // Aarhus
        [55.4038, 10.4024, 0.18],  // Odense
        [57.0488, 9.9217, 0.12],   // Aalborg
        [55.4767, 8.4594, 0.07],   // Esbjerg

        // AFRICA (80+ cities)
        [-26.2041, 28.0473, 5.6], [6.5244, 3.3792, 14.8], [-1.2921, 36.8219, 4.4],
        [33.5731, -7.5898, 3.7], [-4.4419, 15.2663, 14.3], [9.0320, 38.7469, 5.0],
        [36.8065, 10.1815, 0.64], [33.8869, 9.5375, 0.70], [34.0209, -6.8416, 1.2],
        [31.6295, -7.9811, 0.84], [35.7595, -5.8330, 0.20], [12.3714, -1.5197, 2.4],
        [5.6037, -0.1870, 2.3], [6.1256, 1.2223, 0.86], [9.5293, -13.6773, 1.1],
        [14.6928, -17.4467, 1.0], [6.9271, 3.8480, 0.47], [4.8594, 6.9969, 0.41],
        [9.0579, 7.4951, 0.96], [12.0022, 8.5920, 1.3], [11.9961, 8.5171, 0.86],
        [7.3775, 3.9470, 0.53], [-4.3276, 15.3136, 2.1], [-11.6645, 27.4794, 2.5],
        [-15.4167, 28.2833, 0.52], [-17.8252, 31.0335, 1.5], [-1.9536, 30.0606, 1.1],
        [-6.1630, 35.7516, 0.22], [-25.9655, 32.5832, 1.1], [0.3476, 32.5825, 1.5],
        [15.5007, 32.5599, 0.64], [9.0192, 38.7525, 3.4], [11.5950, 37.3903, 0.32],
        [36.7539, 3.0588, 2.9], [35.6911, -0.6417, 0.16], [4.0511, 9.7679, 3.7],
        [3.8480, 11.5021, 2.4], [-29.8587, 31.0218, 0.60], [-33.9249, 18.4241, 0.43],
        [-25.7479, 28.2293, 0.75], [14.7167, -17.4677, 1.0], [7.9465, -1.0232, 2.0],

        // OCEANIA (30+ cities)
        [-33.8688, 151.2093, 5.3], [-37.8136, 144.9631, 5.0], [-27.4698, 153.0251, 2.5],
        [-31.9505, 115.8605, 2.1], [-41.2865, 174.7762, 0.4], [-34.9285, 138.6007, 1.3],
        [-42.8821, 147.3272, 0.23], [-35.2820, 149.1287, 0.40], [-12.4634, 130.8456, 0.15],
        [-43.5321, 172.6362, 0.38], [-36.8485, 174.7633, 1.7], [-37.7870, 175.2793, 0.17],
        [-41.2866, 174.7756, 0.21], [-9.4438, 147.1803, 0.36], [-17.8217, 146.8169, 0.16],
        [-23.6980, 133.8807, 0.03], [-19.2590, 146.8169, 0.18], [-16.9186, 145.7781, 0.15],
      ];
      console.log(`✓ Using fallback dataset with ${cityData.length} cities`);
    }

    // Create multiple heatmap layers for different city size tiers
    const maxPop = 33;

    // Define city size tiers with different radii
    const tiers = [
      { name: 'mega', min: 10, max: Infinity, radius: 35, blur: 25 },      // 10M+ cities
      { name: 'large', min: 3, max: 10, radius: 25, blur: 20 },            // 3-10M cities
      { name: 'medium', min: 1, max: 3, radius: 18, blur: 15 },            // 1-3M cities
      { name: 'small', min: 0.5, max: 1, radius: 12, blur: 12 },           // 500k-1M cities
      { name: 'tiny', min: 0, max: 0.5, radius: 8, blur: 10 }              // 100k-500k cities
    ];

    const gradient = {
      0.0: '#440154',
      0.1: '#482677',
      0.2: '#3b528b',
      0.3: '#2c7bb6',
      0.4: '#21918c',
      0.5: '#28ae80',
      0.6: '#5ec962',
      0.7: '#addc30',
      0.8: '#fde725',
      0.9: '#ff9505',
      1.0: '#ff0000'
    };

    // Create a separate heatmap layer for each tier
    populationHeatmapLayers = tiers.map(tier => {
      // Filter cities in this tier
      const tierCities = cityData.filter(([lat, lng, pop]) =>
        pop >= tier.min && pop < tier.max
      );

      if (tierCities.length === 0) return null;

      // Normalize intensities within this tier
      const tierData = tierCities.map(([lat, lng, pop]) => [
        lat,
        lng,
        Math.max(0.1, Math.min(1.0, pop / maxPop))
      ]);

      // Create heatmap layer for this tier
      const layer = L.heatLayer(tierData, {
        radius: tier.radius,
        blur: tier.blur,
        maxZoom: 18,
        max: 1.0,
        minOpacity: 0.15,
        gradient: gradient
      });

      console.log(`✓ Created ${tier.name} cities layer: ${tierCities.length} cities, radius ${tier.radius}px`);
      return layer;
    }).filter(layer => layer !== null);

    console.log(`✓ Population heatmap created with ${populationHeatmapLayers.length} layers`);
    return populationHeatmapLayers;
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

    // Skip client-side heatmap layers (no date-based tiles or URLs)
    if (config.isHeatmap) {
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
      if (INFRA_LAYER_KEYS.has(layerId)) {
        const group = getOrCreateInfraGroup(layerId);
        if (isActive) {
          if (!map.hasLayer(group)) {
            group.addTo(map);
          }
          // Auto-zoom in so infrastructure becomes visible
          const currentZoom = map.getZoom();
          if (currentZoom < INFRA_MIN_ZOOM) {
            console.log(`🔎 Zooming to ${INFRA_MIN_ZOOM} to show ${layerId}`);
            map.setView(map.getCenter(), INFRA_MIN_ZOOM, { animate: true });
            // zoomend handler will trigger updateVisibleInfrastructure()
          } else {
            updateInfrastructureLayer(layerId);
          }
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
          createPopulationHeatmap().then(heatmapLayers => {
            if (heatmapLayers && heatmapLayers.length > 0) {
              heatmapLayers.forEach(layer => {
                if (layer && !map.hasLayer(layer)) {
                  layer.addTo(map);
                }
              });
              console.log(`✓ Added ${heatmapLayers.length} population heatmap layers`);
            }
          });
        } else {
          populationHeatmapLayers.forEach(layer => {
            if (layer && map.hasLayer(layer)) {
              map.removeLayer(layer);
            }
          });
          console.log('Removed population heatmap layers');
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
    <div class="search-container">
      <input
        class="search-input"
        type="text"
        v-model="searchQuery"
        @input="onSearchInput"
        @keyup.enter="onSearchEnter"
        placeholder="Search for a place or city..."
        :disabled="mapStore.loading"
      />
      <div v-if="isSearchLoading" class="search-loading">Searching...</div>
      <ul v-if="searchResults.length > 0" class="search-results">
        <li
          v-for="res in searchResults"
          :key="`${res.lat},${res.lon}`"
          class="search-item"
          @click="selectSearchResult(res)"
        >
          {{ res.displayName }}
        </li>
      </ul>
    </div>
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

.search-container {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1001;
  width: 320px;
}

.search-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  font-size: 13px;
  background: #ffffff; /* Ensure readable background in dark mode */
  color: #2c3e50;      /* Dark text for readability */
}

.search-input::placeholder {
  color: #9aa0a6;      /* Subtle placeholder contrast on white bg */
}

.search-loading {
  margin-top: 6px;
  font-size: 12px;
  color: #6c757d;
}

.search-results {
  margin: 6px 0 0 0;
  padding: 0;
  list-style: none;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  max-height: 260px;
  overflow-y: auto;
  color: #2c3e50;      /* Ensure list text is visible on white bg */
}

.search-item {
  padding: 8px 10px;
  font-size: 13px;
  cursor: pointer;
}

.search-item:hover {
  background: #f6f9fc;
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
