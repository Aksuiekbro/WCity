import axios from 'axios';

// Use Vite env if provided, otherwise rely on Vite dev proxy via relative '/api'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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
};
