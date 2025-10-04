import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useMapStore = defineStore('map', () => {
  const selectedLocation = ref(null);
  const locationScores = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const activeLayers = ref({
    temperature: false,
    water: false,
    firesCombined: false,
  });

  function setSelectedLocation(lat, lng) {
    selectedLocation.value = { lat, lng };
  }

  function setLocationScores(scores) {
    locationScores.value = scores;
  }

  function setLoading(isLoading) {
    loading.value = isLoading;
  }

  function setError(errorMessage) {
    error.value = errorMessage;
  }

  function toggleLayer(layerName) {
    activeLayers.value[layerName] = !activeLayers.value[layerName];
  }

  function clearSelection() {
    selectedLocation.value = null;
    locationScores.value = null;
    error.value = null;
  }

  return {
    selectedLocation,
    locationScores,
    loading,
    error,
    activeLayers,
    setSelectedLocation,
    setLocationScores,
    setLoading,
    setError,
    toggleLayer,
    clearSelection,
  };
});
