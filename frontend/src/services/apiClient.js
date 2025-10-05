import axios from 'axios';

// Use Vite env if provided, otherwise rely on Vite dev proxy via relative '/api'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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

export const apiClient = {
  async getLocationScore(lat, lng) {
    const response = await axios.get(`${API_BASE_URL}/map/score`, {
      params: { lat, lng },
    });
    return response.data;
  },

  async getLayerData(layerType, bounds) {
    const response = await axios.get(`${API_BASE_URL}/map/layers/${layerType}`, {
      params: { bounds },
    });
    return response.data;
  },

  async getTimeSeries(lat, lng, metric) {
    const response = await axios.get(`${API_BASE_URL}/map/timeseries`, {
      params: { lat, lng, metric },
    });
    return response.data;
  },

  async getRecommendations(lat, lng) {
    const response = await axios.get(`${API_BASE_URL}/map/recommendations`, {
      params: { lat, lng },
    });
    return response.data;
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
};
