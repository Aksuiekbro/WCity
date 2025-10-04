<script setup>
import MapView from './components/MapView.vue'
import LayerControls from './components/LayerControls.vue'
import LocationPanel from './components/LocationPanel.vue'
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>🌍 WCity - NASA Environmental Data Viewer</h1>
      <p>Interactive city suitability analysis using NASA satellite data</p>
    </header>

    <div class="main-layout">
      <aside class="sidebar-left">
        <LayerControls />
      </aside>

      <main class="map-section">
        <MapView />
      </main>

      <aside class="sidebar-right">
        <LocationPanel />
      </aside>
    </div>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f5f6fa;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-header {
  background: linear-gradient(
    -45deg,
    #667eea,
    #764ba2,
    #f093fb,
    #4facfe,
    #00f2fe,
    #667eea
  );
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
  color: white;
  padding: 20px 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.app-header h1 {
  font-size: 24px;
  margin: 0 0 5px 0;
}

.app-header p {
  font-size: 14px;
  opacity: 0.9;
  margin: 0;
}

.main-layout {
  display: grid;
  grid-template-columns: 300px 1fr 350px;
  gap: 15px;
  padding: 15px;
  height: calc(100vh - 90px);
  overflow: hidden;
}

.sidebar-left,
.sidebar-right {
  overflow-y: auto;
}

.map-section {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: 100%;
}

@media (max-width: 1200px) {
  .main-layout {
    grid-template-columns: 250px 1fr 300px;
  }
}

@media (max-width: 768px) {
  .main-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }

  .sidebar-left,
  .sidebar-right {
    max-height: 200px;
  }
}
</style>
