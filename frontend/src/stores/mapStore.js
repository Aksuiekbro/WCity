import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getRecentGIBSDate } from '../utils/dateUtils';

export const useMapStore = defineStore('map', () => {
  const selectedLocation = ref(null);
  const locationScores = ref(null);
  const recommendations = ref(null);
  const loadingRecommendations = ref(false);
  const loading = ref(false);
  const error = ref(null);
  // Selected base date for GIBS layers (YYYY-MM-DD)
  const gibsDate = ref(getRecentGIBSDate());

  const activeLayers = ref({
    temperature: false,
    water: false,
    firesCombined: false,
    aodValueAdded: false,
    aquaLSTNight: false,
    terraLSTDay: false,
    terraLSTNight: false,
    aquaBT31Day: false,
    aquaBT31Night: false,
    terraBT31Day: false,
    terraBT31Night: false,
    hospitals: false,
    schools: false,
  });

  function setSelectedLocation(lat, lng) {
    selectedLocation.value = { lat, lng };
  }

  function setLocationScores(scores) {
    locationScores.value = scores;
  }

  function setRecommendations(recs) {
    recommendations.value = recs;
  }

  function setLoadingRecommendations(isLoading) {
    loadingRecommendations.value = isLoading;
  }

  function setLoading(isLoading) {
    loading.value = isLoading;
  }

  function setError(errorMessage) {
    error.value = errorMessage;
  }

  function setGibsDate(dateStr) {
    gibsDate.value = dateStr;
  }

  function toggleLayer(layerName) {
    activeLayers.value[layerName] = !activeLayers.value[layerName];
  }

  function clearSelection() {
    selectedLocation.value = null;
    locationScores.value = null;
    recommendations.value = null;
    error.value = null;
  }

  return {
    selectedLocation,
    locationScores,
    recommendations,
    loadingRecommendations,
    loading,
    error,
    gibsDate,
    activeLayers,
    setSelectedLocation,
    setLocationScores,
    setRecommendations,
    setLoadingRecommendations,
    setLoading,
    setError,
    setGibsDate,
    toggleLayer,
    clearSelection,
  };
});
