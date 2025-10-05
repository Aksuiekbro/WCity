<script setup>
import { computed, watch } from 'vue';
import { useMapStore } from '../stores/mapStore';
import { apiClient } from '../services/apiClient';

const mapStore = useMapStore();

const scores = computed(() => mapStore.locationScores);
const hasData = computed(() => scores.value !== null);
const recommendations = computed(() => mapStore.recommendations);
const loadingRecs = computed(() => mapStore.loadingRecommendations);

// Fetch recommendations when location scores are available
watch(scores, async (newScores) => {
  if (newScores && newScores.location) {
    mapStore.setLoadingRecommendations(true);
    try {
      const recs = await apiClient.getRecommendations(
        newScores.location.lat,
        newScores.location.lng
      );
      mapStore.setRecommendations(recs);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      mapStore.setRecommendations(null);
    } finally {
      mapStore.setLoadingRecommendations(false);
    }
  }
});

function getScoreColor(score) {
  if (score >= 80) return '#27ae60';
  if (score >= 60) return '#f39c12';
  if (score >= 40) return '#e67e22';
  return '#e74c3c';
}

function formatCoordinate(coord, isLat) {
  const direction = isLat ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
  return `${Math.abs(coord).toFixed(4)}° ${direction}`;
}
</script>

<template>
  <div class="location-panel">
    <div class="panel-header">
      <h2>Location Analysis</h2>
      <button v-if="hasData" @click="mapStore.clearSelection()" class="clear-btn">
        Clear
      </button>
    </div>

    <div v-if="!hasData" class="empty-state">
      <div class="icon">📍</div>
      <p>Click anywhere on the map to analyze that location</p>
    </div>

    <div v-else class="scores-container">
      <!-- Location info -->
      <div class="location-info">
        <div class="coordinates">
          <span>{{ formatCoordinate(scores.location.lat, true) }}</span>
          <span>{{ formatCoordinate(scores.location.lng, false) }}</span>
        </div>
      </div>

      <!-- Overall Score -->
      <div class="overall-score">
        <div class="score-circle" :style="{ borderColor: getScoreColor(scores.overall.score) }">
          <div class="score-value">{{ scores.overall.score }}</div>
          <div class="score-label">/ 100</div>
        </div>
        <div class="grade">{{ scores.overall.grade }}</div>
        <div class="suitability">{{ scores.overall.suitability }}</div>
      </div>

      <!-- Individual Scores -->
      <div class="metric-scores">
        <!-- Air Quality -->
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-icon">🌫️</span>
            <span class="metric-name">Air Quality</span>
          </div>
          <div class="metric-score" :style="{ color: getScoreColor(scores.scores.airQuality.score) }">
            {{ scores.scores.airQuality.score }}%
          </div>
          <div class="metric-detail">
            <small>AOD: {{ scores.scores.airQuality.aod.toFixed(3) }}</small>
            <small class="interpretation">{{ scores.scores.airQuality.interpretation }}</small>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{
                width: scores.scores.airQuality.score + '%',
                background: getScoreColor(scores.scores.airQuality.score)
              }"
            ></div>
          </div>
        </div>

        <!-- Vegetation -->
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-icon">🌳</span>
            <span class="metric-name">Vegetation</span>
          </div>
          <div class="metric-score" :style="{ color: getScoreColor(scores.scores.vegetation.score) }">
            {{ scores.scores.vegetation.score }}%
          </div>
          <div class="metric-detail">
            <small>NDVI: {{ scores.scores.vegetation.ndvi.toFixed(3) }}</small>
            <small class="interpretation">{{ scores.scores.vegetation.interpretation }}</small>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{
                width: scores.scores.vegetation.score + '%',
                background: getScoreColor(scores.scores.vegetation.score)
              }"
            ></div>
          </div>
        </div>

        <!-- Temperature -->
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-icon">🌡️</span>
            <span class="metric-name">Temperature</span>
          </div>
          <div class="metric-score" :style="{ color: getScoreColor(scores.scores.temperature.score) }">
            {{ scores.scores.temperature.score }}%
          </div>
          <div class="metric-detail">
            <small>{{ scores.scores.temperature.current }}{{ scores.scores.temperature.unit }}</small>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{
                width: scores.scores.temperature.score + '%',
                background: getScoreColor(scores.scores.temperature.score)
              }"
            ></div>
          </div>
        </div>

        <!-- Water -->
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-icon">💧</span>
            <span class="metric-name">Water Availability</span>
          </div>
          <div class="metric-score" :style="{ color: getScoreColor(scores.scores.water.score) }">
            {{ scores.scores.water.score }}%
          </div>
          <div class="metric-detail">
            <small>Soil Moisture: {{ scores.scores.water.soilMoisture }}</small>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{
                width: scores.scores.water.score + '%',
                background: getScoreColor(scores.scores.water.score)
              }"
            ></div>
          </div>
        </div>

        <!-- Urbanization -->
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-icon">🏙️</span>
            <span class="metric-name">Urbanization</span>
          </div>
          <div class="metric-score" :style="{ color: getScoreColor(scores.scores.urbanization.score) }">
            {{ scores.scores.urbanization.score }}%
          </div>
          <div class="metric-detail">
            <small>{{ scores.scores.urbanization.populationDensity }} {{ scores.scores.urbanization.unit }}</small>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{
                width: scores.scores.urbanization.score + '%',
                background: getScoreColor(scores.scores.urbanization.score)
              }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Infrastructure Recommendations -->
      <div v-if="loadingRecs || recommendations" class="recommendations-section">
        <div class="section-header">
          <h3>🏗️ Infrastructure Recommendations</h3>
          <span v-if="recommendations" class="priority-badge" :class="`priority-${recommendations.priority}`">
            {{ recommendations.priority?.toUpperCase() }} PRIORITY
          </span>
        </div>

        <div v-if="loadingRecs" class="loading-state">
          <div class="spinner-small"></div>
          <p>Analyzing environmental data with AI...</p>
        </div>

        <div v-else-if="recommendations">
          <div class="summary">
            <strong>Summary:</strong> {{ recommendations.summary }}
          </div>

          <ul class="recommendations-list">
            <li v-for="(rec, index) in recommendations.recommendations" :key="index" class="recommendation-item">
              <span class="rec-number">{{ index + 1 }}</span>
              <span class="rec-text">{{ rec }}</span>
            </li>
          </ul>

          <div class="ai-attribution">
            <small>💡 Generated by AI based on environmental analysis</small>
          </div>
        </div>
      </div>

      <!-- Timestamp -->
      <div class="timestamp">
        <small>Data as of {{ new Date(scores.timestamp).toLocaleString() }}</small>
      </div>
    </div>

    <div v-if="mapStore.error" class="error-message">
      {{ mapStore.error }}
    </div>
  </div>
</template>

<style scoped>
.location-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: 100%;
  overflow-y: auto;
  color: #2c3e50; /* Ensure readable text on white panel (dark mode fix) */
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.panel-header h2 {
  margin: 0;
  font-size: 20px;
  color: #2c3e50;
}

.clear-btn {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.clear-btn:hover {
  background: #c0392b;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
}

.empty-state .icon {
  font-size: 48px;
  margin-bottom: 15px;
}

.location-info {
  margin-bottom: 20px;
}

.coordinates {
  display: flex;
  justify-content: space-around;
  background: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
  font-size: 14px;
  font-family: monospace;
  color: #2c3e50; /* Explicitly set coordinate text color */
}

.overall-score {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
  margin-bottom: 20px;
}

.score-circle {
  display: inline-block;
  width: 120px;
  height: 120px;
  border: 8px solid white;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.score-value {
  font-size: 36px;
  font-weight: bold;
}

.score-label {
  font-size: 14px;
  opacity: 0.9;
}

.grade {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 5px;
}

.suitability {
  font-size: 14px;
  opacity: 0.9;
}

.metric-scores {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.metric-card {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  border-left: 4px solid #3498db;
}

.metric-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.metric-icon {
  font-size: 24px;
  margin-right: 10px;
}

.metric-name {
  font-weight: 600;
  color: #2c3e50;
}

.metric-score {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 5px;
}

.metric-detail {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 10px;
  font-size: 12px;
  color: #6c757d;
}

.interpretation {
  font-weight: 600;
  color: #495057;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.timestamp {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #e9ecef;
  text-align: center;
  color: #6c757d;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin-top: 10px;
  font-size: 14px;
}

/* Recommendations Section */
.recommendations-section {
  margin-top: 25px;
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 8px;
  border: 2px solid #667eea;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.section-header h3 {
  margin: 0;
  font-size: 18px;
  color: #2c3e50;
}

.priority-badge {
  font-size: 11px;
  font-weight: bold;
  padding: 4px 10px;
  border-radius: 12px;
  letter-spacing: 0.5px;
}

.priority-high {
  background: #e74c3c;
  color: white;
}

.priority-medium {
  background: #f39c12;
  color: white;
}

.priority-low {
  background: #27ae60;
  color: white;
}

.loading-state {
  text-align: center;
  padding: 30px;
  color: #6c757d;
}

.spinner-small {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
  margin: 0 auto 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.summary {
  background: white;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 15px;
  font-size: 14px;
  line-height: 1.6;
  color: #495057;
  border-left: 4px solid #667eea;
}

.recommendations-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.recommendation-item {
  display: flex;
  gap: 12px;
  background: white;
  padding: 12px;
  margin-bottom: 10px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.5;
  color: #2c3e50;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.rec-number {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  background: #667eea;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.rec-text {
  flex: 1;
}

.ai-attribution {
  text-align: center;
  margin-top: 15px;
  color: #6c757d;
  font-style: italic;
}
</style>
