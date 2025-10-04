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

  aodValueAdded: {
    id: 'aodValueAdded',
    name: 'Aerosol Optical Depth (VIIRS NOAA-20)',
    gibsId: 'VIIRS_NOAA20_Aerosol_Optical_Depth',
    description: 'VIIRS NOAA-20 Aerosol Optical Depth (AOD)',
    url: getGIBSTileUrl('VIIRS_NOAA20_Aerosol_Optical_Depth', '{date}', 9),
    attribution: 'NASA EOSDIS GIBS / VIIRS NOAA-20',
    opacity: 0.65,
    tileSize: 256,
    maxZoom: 9,
    dateFormat: 'previousYear',
    legend: {
      min: 0,
      max: 1.0,
      unit: 'AOD',
      colors: ['#00ff00', '#ffff00', '#ffa500', '#ff0000', '#800000'],
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
    // Vector MVT endpoint (EPSG:3857)
    isVector: true,
    mvtUrl:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Combined_Thermal_Anomalies_All/default/{date}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.mvt',
    attribution: 'NASA EOSDIS GIBS / MODIS (MCD14)',
    opacity: 0.85,
    tileSize: 256,
    maxZoom: 7,
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

  // Additional MODIS Temperature and Brightness Temperature layers
  aquaLSTNight: {
    id: 'aquaLSTNight',
    name: 'Surface Temperature (Aqua Night)',
    gibsId: 'MODIS_Aqua_Land_Surface_Temp_Night',
    description: 'Land Surface Temperature during nighttime (Aqua)',
    url: getGIBSTileUrl('MODIS_Aqua_Land_Surface_Temp_Night', '{date}', 7),
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

  terraLSTDay: {
    id: 'terraLSTDay',
    name: 'Surface Temperature (Terra Day)',
    gibsId: 'MODIS_Terra_Land_Surface_Temp_Day',
    description: 'Land Surface Temperature during daytime (Terra)',
    url: getGIBSTileUrl('MODIS_Terra_Land_Surface_Temp_Day', '{date}', 7),
    attribution: 'NASA EOSDIS GIBS / MODIS Terra',
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

  terraLSTNight: {
    id: 'terraLSTNight',
    name: 'Surface Temperature (Terra Night)',
    gibsId: 'MODIS_Terra_Land_Surface_Temp_Night',
    description: 'Land Surface Temperature during nighttime (Terra)',
    url: getGIBSTileUrl('MODIS_Terra_Land_Surface_Temp_Night', '{date}', 7),
    attribution: 'NASA EOSDIS GIBS / MODIS Terra',
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

  aquaBT31Day: {
    id: 'aquaBT31Day',
    name: 'Brightness Temp Band 31 (Aqua Day)',
    gibsId: 'MODIS_Aqua_Brightness_Temp_Band31_Day',
    description: 'Brightness temperature (Band 31) daytime (Aqua)',
    url: getGIBSTileUrl('MODIS_Aqua_Brightness_Temp_Band31_Day', '{date}', 7),
    attribution: 'NASA EOSDIS GIBS / MODIS Aqua',
    opacity: 0.6,
    tileSize: 256,
    maxZoom: 7,
    dateFormat: 'daily',
    legend: {
      min: 200,
      max: 330,
      unit: 'K',
      colors: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'],
    },
  },

  aquaBT31Night: {
    id: 'aquaBT31Night',
    name: 'Brightness Temp Band 31 (Aqua Night)',
    gibsId: 'MODIS_Aqua_Brightness_Temp_Band31_Night',
    description: 'Brightness temperature (Band 31) nighttime (Aqua)',
    url: getGIBSTileUrl('MODIS_Aqua_Brightness_Temp_Band31_Night', '{date}', 7),
    attribution: 'NASA EOSDIS GIBS / MODIS Aqua',
    opacity: 0.6,
    tileSize: 256,
    maxZoom: 7,
    dateFormat: 'daily',
    legend: {
      min: 200,
      max: 330,
      unit: 'K',
      colors: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'],
    },
  },

  terraBT31Day: {
    id: 'terraBT31Day',
    name: 'Brightness Temp Band 31 (Terra Day)',
    gibsId: 'MODIS_Terra_Brightness_Temp_Band31_Day',
    description: 'Brightness temperature (Band 31) daytime (Terra)',
    url: getGIBSTileUrl('MODIS_Terra_Brightness_Temp_Band31_Day', '{date}', 7),
    attribution: 'NASA EOSDIS GIBS / MODIS Terra',
    opacity: 0.6,
    tileSize: 256,
    maxZoom: 7,
    dateFormat: 'daily',
    legend: {
      min: 200,
      max: 330,
      unit: 'K',
      colors: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'],
    },
  },

  terraBT31Night: {
    id: 'terraBT31Night',
    name: 'Brightness Temp Band 31 (Terra Night)',
    gibsId: 'MODIS_Terra_Brightness_Temp_Band31_Night',
    description: 'Brightness temperature (Band 31) nighttime (Terra)',
    url: getGIBSTileUrl('MODIS_Terra_Brightness_Temp_Band31_Night', '{date}', 7),
    attribution: 'NASA EOSDIS GIBS / MODIS Terra',
    opacity: 0.6,
    tileSize: 256,
    maxZoom: 7,
    dateFormat: 'daily',
    legend: {
      min: 200,
      max: 330,
      unit: 'K',
      colors: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'],
    },
  },

  // Population Density Heatmap - Client-side visualization using leaflet.heat
  populationDensity: {
    id: 'populationDensity',
    name: 'Population Heatmap',
    description: 'Global population density heatmap from city data',
    isHeatmap: true,
    attribution: 'GeoNames / City Population Data',
    opacity: 0.6,
    legend: {
      min: 0,
      max: 10000,
      unit: 'people/km²',
      colors: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
    },
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
 * Map layer IDs to GIBS configs (includes WMS layers like SEDAC)
 */
export const LAYER_ID_TO_GIBS = {
  temperature: 'temperature',
  aodValueAdded: 'aodValueAdded',
  water: 'water',
  firesCombined: 'firesCombined',
  aquaLSTNight: 'aquaLSTNight',
  terraLSTDay: 'terraLSTDay',
  terraLSTNight: 'terraLSTNight',
  aquaBT31Day: 'aquaBT31Day',
  aquaBT31Night: 'aquaBT31Night',
  terraBT31Day: 'terraBT31Day',
  terraBT31Night: 'terraBT31Night',
  populationDensity: 'populationDensity',
};
