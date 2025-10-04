import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { LocationScores } from '../services/apiClient';

export const useMapStore = defineStore('map', () => {
  // State
  const selectedLocation = ref<{ lat: number; lng: number } | null>(null);
  const locationScores = ref<LocationScores | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Active layers
  const activeLayers = ref({
    airQuality: false,
    vegetation: false,
    temperature: false,
    water: false,
  });

  // Actions
  function setSelectedLocation(lat: number, lng: number) {
    selectedLocation.value = { lat, lng };
  }

  function setLocationScores(scores: LocationScores) {
    locationScores.value = scores;
  }

  function setLoading(isLoading: boolean) {
    loading.value = isLoading;
  }

  function setError(errorMessage: string | null) {
    error.value = errorMessage;
  }

  function toggleLayer(layerName: keyof typeof activeLayers.value) {
    activeLayers.value[layerName] = !activeLayers.value[layerName];
  }

  function clearSelection() {
    selectedLocation.value = null;
    locationScores.value = null;
    error.value = null;
  }

  return {
    // State
    selectedLocation,
    locationScores,
    loading,
    error,
    activeLayers,

    // Actions
    setSelectedLocation,
    setLocationScores,
    setLoading,
    setError,
    toggleLayer,
    clearSelection,
  };
});
