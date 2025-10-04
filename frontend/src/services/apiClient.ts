import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

export interface LocationScores {
  location: {
    lat: number;
    lng: number;
  };
  scores: {
    airQuality: {
      score: number;
      aod: number;
      interpretation: string;
    };
    vegetation: {
      score: number;
      ndvi: number;
      interpretation: string;
    };
    temperature: {
      score: number;
      current: number;
      unit: string;
    };
    water: {
      score: number;
      soilMoisture: number;
      unit: string;
    };
    urbanization: {
      score: number;
      populationDensity: number;
      unit: string;
    };
  };
  overall: {
    score: number;
    grade: string;
    suitability: string;
  };
  timestamp: string;
}

export const apiClient = {
  async getLocationScore(lat: number, lng: number): Promise<LocationScores> {
    const response = await axios.get(`${API_BASE_URL}/api/map/score`, {
      params: { lat, lng },
    });
    return response.data;
  },

  async getLayerData(layerType: string, bounds: string) {
    const response = await axios.get(`${API_BASE_URL}/api/map/layers/${layerType}`, {
      params: { bounds },
    });
    return response.data;
  },

  async getTimeSeries(lat: number, lng: number, metric: string) {
    const response = await axios.get(`${API_BASE_URL}/api/map/timeseries`, {
      params: { lat, lng, metric },
    });
    return response.data;
  },
};
