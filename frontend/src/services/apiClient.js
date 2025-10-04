import axios from 'axios';

// Use Vite env if provided, otherwise default to explicit backend URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Fallback bases for dev: try proxy, then explicit localhost ports
const API_BASE_FALLBACKS = Array.from(
  new Set([
    API_BASE_URL,
    '/api',
    'http://localhost:3000/api',
    'http://localhost:3001/api',
  ])
);

async function getWithFallback(path, params) {
  let lastError;
  for (const base of API_BASE_FALLBACKS) {
    try {
      const url = `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
      const response = await axios.get(url, { params });
      return response.data;
    } catch (err) {
      lastError = err;
      // Try next base
    }
  }
  throw lastError;
}

async function postWithFallback(path, payload) {
  let lastError;
  for (const base of API_BASE_FALLBACKS) {
    try {
      const url = `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
      const response = await axios.post(url, payload);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export const apiClient = {
  async getLocationScore(lat, lng) {
    return await getWithFallback('map/score', { lat, lng });
  },

  async getLayerData(layerType, bounds) {
    return await getWithFallback(`map/layers/${layerType}`, { bounds });
  },

  async getTimeSeries(lat, lng, metric) {
    return await getWithFallback('map/timeseries', { lat, lng, metric });
  },

  async getRecommendations(lat, lng) {
    return await getWithFallback('map/recommendations', { lat, lng });
  },

  async getCitiesInViewport(north, south, east, west) {
    return await getWithFallback('map/cities', { north, south, east, west });
  },

  async getInfrastructureInViewport(type, north, south, east, west) {
    return await getWithFallback('map/infrastructure', {
      type,
      north,
      south,
      east,
      west,
    });
  },

  async getPlanningRecommendations(payload) {
    return await postWithFallback('map/planning/recommendations', payload);
  },
};
