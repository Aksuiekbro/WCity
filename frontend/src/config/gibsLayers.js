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
  airQuality: {
    id: 'airQuality',
    name: 'Air Quality (Aerosol)',
    gibsId: 'MODIS_Terra_Aerosol',
    description: 'Aerosol Optical Depth (AOD) - measure of air pollution and haze',
    url: getGIBSTileUrl('MODIS_Terra_Aerosol', '{date}', 9),
    attribution: 'NASA EOSDIS GIBS / MODIS Terra',
    opacity: 0.6,
    tileSize: 256,
    maxZoom: 9,
    dateFormat: 'daily',
    legend: {
      min: 0,
      max: 1.0,
      unit: 'AOD',
      colors: ['#00ff00', '#ffff00', '#ff9900', '#ff0000', '#990000'],
    },
  },

  vegetation: {
    id: 'vegetation',
    name: 'Vegetation (NDVI)',
    gibsId: 'MODIS_Terra_NDVI_16Day',
    description: 'Normalized Difference Vegetation Index - vegetation health and density',
    url: getGIBSTileUrl('MODIS_Terra_NDVI_16Day', '{date}', 9),
    attribution: 'NASA EOSDIS GIBS / MODIS Terra',
    opacity: 0.65,
    tileSize: 256,
    maxZoom: 9,
    dateFormat: '16day',
    legend: {
      min: -0.2,
      max: 1.0,
      unit: 'NDVI',
      colors: ['#b96947', '#d4cf68', '#8fbc5a', '#4e9c3d', '#1f6b2f'],
    },
  },

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
  fires: {
    id: 'fires',
    name: 'Active Fires',
    gibsId: 'MODIS_Terra_Thermal_Anomalies_All',
    description: 'Thermal anomalies and active fire detection',
    url: getGIBSTileUrl('MODIS_Terra_Thermal_Anomalies_All', '{date}', 9),
    attribution: 'NASA EOSDIS GIBS / MODIS Terra FIRMS',
    opacity: 0.8,
    tileSize: 256,
    maxZoom: 9,
    dateFormat: 'daily',
    legend: {
      min: 0,
      max: 100,
      unit: 'Fire Radiative Power',
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
  airQuality: 'airQuality',
  vegetation: 'vegetation',
  temperature: 'temperature',
  water: 'water',
};
