<script setup>
import { useMapStore } from '../stores/mapStore';
import { GIBS_LAYERS, LAYER_ID_TO_GIBS } from '../config/gibsLayers';
import { getRecentGIBSDate, resolveGIBSDate } from '../utils/dateUtils';

const mapStore = useMapStore();

const infrastructureLayers = [
  {
    key: 'hospitals',
    label: 'Hospitals',
    color: '#e74c3c',
    icon: '🏥',
    description: 'Healthcare facilities'
  },
  {
    key: 'schools',
    label: 'Schools',
    color: '#3498db',
    icon: '🏫',
    description: 'Educational institutions'
  },
];

const layers = [
  {
    key: 'temperature',
    label: 'Surface Temperature',
    color: '#f39c12',
    icon: '🌡️',
    description: 'Land surface temperature'
  },
  {
    key: 'aquaLSTNight',
    label: 'Surface Temperature (Aqua Night)',
    color: '#f39c12',
    icon: '🌡️',
    description: 'MODIS Aqua LST Night'
  },
  {
    key: 'terraLSTDay',
    label: 'Surface Temperature (Terra Day)',
    color: '#f39c12',
    icon: '🌡️',
    description: 'MODIS Terra LST Day'
  },
  {
    key: 'terraLSTNight',
    label: 'Surface Temperature (Terra Night)',
    color: '#f39c12',
    icon: '🌡️',
    description: 'MODIS Terra LST Night'
  },
  {
    key: 'aodValueAdded',
    label: 'Aerosol Optical Depth (VIIRS NOAA-20)',
    color: '#9b59b6',
    icon: '🌫️',
    description: 'VIIRS NOAA-20 Aerosol Optical Depth'
  },
  {
    key: 'aquaBT31Day',
    label: 'Brightness Temp Band 31 (Aqua Day)',
    color: '#e74c3c',
    icon: '📡',
    description: 'MODIS Aqua BT31 Day'
  },
  {
    key: 'aquaBT31Night',
    label: 'Brightness Temp Band 31 (Aqua Night)',
    color: '#e74c3c',
    icon: '📡',
    description: 'MODIS Aqua BT31 Night'
  },
  {
    key: 'terraBT31Day',
    label: 'Brightness Temp Band 31 (Terra Day)',
    color: '#e74c3c',
    icon: '📡',
    description: 'MODIS Terra BT31 Day'
  },
  {
    key: 'terraBT31Night',
    label: 'Brightness Temp Band 31 (Terra Night)',
    color: '#e74c3c',
    icon: '📡',
    description: 'MODIS Terra BT31 Night'
  },
  {
    key: 'water',
    label: 'Water Bodies',
    color: '#3498db',
    icon: '💧',
    description: 'True color imagery'
  },
  {
    key: 'firesCombined',
    label: 'Thermal Anomalies (Fires)',
    color: '#e74c3c',
    icon: '🔥',
    description: 'MODIS Combined active fires & thermal anomalies'
  },
  {
    key: 'populationDensity',
    label: 'Population Density (2020)',
    color: '#5ec962',
    icon: '👥',
    description: 'WorldPop global population density'
  },
];

// Get current date being displayed
function getCurrentDate(layerId) {
  const gibsId = LAYER_ID_TO_GIBS[layerId];
  const config = GIBS_LAYERS[gibsId];
  if (!config) return 'N/A';

  const date = resolveGIBSDate(config.dateFormat, mapStore.gibsDate);
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Get legend info for a layer
function getLegend(layerId) {
  const gibsId = LAYER_ID_TO_GIBS[layerId];
  const config = GIBS_LAYERS[gibsId];
  return config?.legend;
}

// Date bounds for date picker
const maxDate = getRecentGIBSDate();
const minDate = '2000-02-24';
</script>

<template>
  <div class="layer-controls">
    <h3>NASA Data Layers</h3>
    <div class="date-picker">
      <label for="gibsDate">GIBS Date</label>
      <input
        id="gibsDate"
        type="date"
        :max="maxDate"
        :min="minDate"
        v-model="mapStore.gibsDate"
      />
    </div>
    <div class="layer-list">
      <div
        v-for="layer in layers"
        :key="layer.key"
        class="layer-item"
        :class="{ active: mapStore.activeLayers[layer.key] }"
      >
        <div class="layer-header" @click="mapStore.toggleLayer(layer.key)">
          <span class="layer-icon">{{ layer.icon }}</span>
          <div class="layer-text">
            <span class="layer-label">{{ layer.label }}</span>
            <span class="layer-desc">{{ layer.description }}</span>
          </div>
          <div class="toggle-switch">
            <input
              type="checkbox"
              :checked="mapStore.activeLayers[layer.key]"
              @click.stop="mapStore.toggleLayer(layer.key)"
            />
            <span class="slider"></span>
          </div>
        </div>

        <!-- Legend (shown when active) -->
        <div
          v-if="mapStore.activeLayers[layer.key] && getLegend(layer.key)"
          class="layer-legend"
        >
          <div class="legend-gradient" :style="{
            background: `linear-gradient(to right, ${getLegend(layer.key)?.colors.join(', ')})`
          }"></div>
          <div class="legend-labels">
            <span>{{ getLegend(layer.key)?.min }}</span>
            <span>{{ getLegend(layer.key)?.unit }}</span>
            <span>{{ getLegend(layer.key)?.max }}</span>
          </div>
          <div class="layer-date">
            📅 {{ getCurrentDate(layer.key) }}
          </div>
        </div>
      </div>
    </div>

    <h3 style="margin-top: 16px;">Infrastructure</h3>
    <div class="layer-list">
      <div
        v-for="layer in infrastructureLayers"
        :key="layer.key"
        class="layer-item"
        :class="{ active: mapStore.activeLayers[layer.key] }"
      >
        <div class="layer-header" @click="mapStore.toggleLayer(layer.key)">
          <span class="layer-icon">{{ layer.icon }}</span>
          <div class="layer-text">
            <span class="layer-label">{{ layer.label }}</span>
            <span class="layer-desc">{{ layer.description }}</span>
          </div>
          <div class="toggle-switch">
            <input
              type="checkbox"
              :checked="mapStore.activeLayers[layer.key]"
              @click.stop="mapStore.toggleLayer(layer.key)"
            />
            <span class="slider"></span>
          </div>
        </div>
      </div>
    </div>

    <div class="layer-info">
      <div class="info-badge">
        <span class="badge-icon">🛰️</span>
        <div class="badge-text">
          <strong>NASA GIBS</strong>
          <small>Real-time satellite imagery</small>
        </div>
      </div>
      <p style="font-size: 12px; opacity: 0.7; margin-top: 10px;">
        Click on the map to analyze environmental data for any location
      </p>
    </div>
  </div>
</template>

<style scoped>
.layer-controls {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.date-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.date-picker label {
  font-size: 12px;
  color: #2c3e50;
  opacity: 0.8;
}

.date-picker input[type="date"] {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}

h3 {
  margin: 0 0 15px 0;
  font-size: 18px;
  color: #2c3e50;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.layer-item {
  border-radius: 8px;
  transition: all 0.2s;
  background: #f8f9fa;
  overflow: hidden;
}

.layer-item.active {
  background: #e3f2fd;
  border-left: 4px solid #2196F3;
}

.layer-header {
  display: flex;
  align-items: center;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.layer-header:hover {
  background: rgba(0, 0, 0, 0.03);
}

.layer-icon {
  font-size: 24px;
  margin-right: 12px;
}

.layer-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.layer-label {
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
}

.layer-desc {
  font-size: 11px;
  color: #6c757d;
}

.toggle-switch {
  position: relative;
  width: 50px;
  height: 24px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #2196F3;
}

input:checked + .slider:before {
  transform: translateX(26px);
}

/* Legend Styles */
.layer-legend {
  padding: 8px 12px 12px 48px;
  background: rgba(33, 150, 243, 0.05);
  border-top: 1px solid rgba(33, 150, 243, 0.1);
}

.legend-gradient {
  height: 8px;
  border-radius: 4px;
  margin-bottom: 5px;
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #6c757d;
  font-weight: 500;
}

.layer-date {
  margin-top: 6px;
  font-size: 10px;
  color: #6c757d;
  text-align: center;
}

/* Info Section */
.layer-info {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #e9ecef;
}

.info-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 12px;
  border-radius: 6px;
  color: white;
}

.badge-icon {
  font-size: 28px;
}

.badge-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.badge-text strong {
  font-size: 14px;
}

.badge-text small {
  font-size: 11px;
  opacity: 0.9;
}

.layer-info p {
  margin: 0;
  text-align: center;
  color: #6c757d;
}
</style>
