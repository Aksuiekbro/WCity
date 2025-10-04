/**
 * NASA GIBS (Global Imagery Browse Services) Layer Configurations
 * Documentation: https://wiki.earthdata.nasa.gov/display/GIBS
 */

/**
 * Get GIBS tile URL for a specific layer and date
 */
export function getGIBSTileUrl(gibsId, date, level = 9) {
  const baseUrl = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
  return `${baseUrl}/${gibsId}/default/${date}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.png`;
}

/**
 * NASA GIBS Layers Configuration
 */
export const GIBS_LAYERS = {
  temperature: {
    id: 'temperature',
    name: 'Surface Temperature',
    gibsId: 'MODIS_Aqua_Land_Surface_Temp_Day',
    description: 'Land Surface Temperature during daytime',
    url: getGIBSTileUrl('MODIS_Aqua_Land_Surface_Temp_Day', '{date}', 7),
    attribution: 'NASA EOSDIS GIBS / MODIS Aqua',
    opacity: 0.6,
    tileSize: 256,
    maxZoom: 7,
    dateFormat: 'daily',
    legend: {
      min: -25,
      max: 45,
      unit: '°C',
      colors: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'],
    },
  },

  water: {
    id: 'water',
    name: 'Water Bodies',
    gibsId: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    description: 'True color imagery showing water bodies and land features',
    url: getGIBSTileUrl('VIIRS_NOAA20_CorrectedReflectance_TrueColor', '{date}', 9),
    attribution: 'NASA EOSDIS GIBS / VIIRS NOAA-20',
    opacity: 0.5,
    tileSize: 256,
    maxZoom: 9,
    dateFormat: 'daily',
  },

  // Bonus layers for enhanced functionality
  firesCombined: {
    id: 'firesCombined',
    name: 'Fires & Thermal Anomalies (Combined)',
    gibsId: 'MODIS_Combined_Thermal_Anomalies_All',
    description:
      'Active fire detections and thermal anomalies (volcanoes, gas flares) from combined Terra+Aqua MODIS (1 km, daily).',
    url: getGIBSTileUrl('MODIS_Combined_Thermal_Anomalies_All', '{date}', 9),
    attribution: 'NASA EOSDIS GIBS / MODIS (MCD14)',
    opacity: 0.85,
    tileSize: 256,
    maxZoom: 9,
    dateFormat: 'daily',
    legend: {
      min: 0,
      max: 100,
      unit: 'FRP',
      colors: ['#ffff00', '#ff9900', '#ff0000'],
    },
  },

  trueColor: {
    id: 'trueColor',
    name: 'True Color Imagery',
    gibsId: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    description: 'Natural color satellite imagery',
    url: getGIBSTileUrl('MODIS_Terra_CorrectedReflectance_TrueColor', '{date}', 9),
    attribution: 'NASA EOSDIS GIBS / MODIS Terra',
    opacity: 0.7,
    tileSize: 256,
    maxZoom: 9,
    dateFormat: 'daily',
  },
};

/**
 * Get available GIBS layers for the app
 */
export function getAvailableGIBSLayers() {
  return Object.values(GIBS_LAYERS);
}

/**
 * Get GIBS layer by ID
 */
export function getGIBSLayerById(id) {
  return GIBS_LAYERS[id];
}

/**
 * Map layer IDs to GIBS configs
 */
export const LAYER_ID_TO_GIBS = {
  temperature: 'temperature',
  water: 'water',
  firesCombined: 'firesCombined',
};
