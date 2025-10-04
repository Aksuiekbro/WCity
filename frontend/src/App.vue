<script setup>
import { ref, onBeforeUnmount } from 'vue'
import MapView from './components/MapView.vue'
import LayerControls from './components/LayerControls.vue'
import LocationPanel from './components/LocationPanel.vue'

const sidebarRightWidth = ref(350)
const isResizing = ref(false)
let startX = 0
let startWidth = 350
const MIN_WIDTH = 250
const MAX_WIDTH = 800

function onResizeStart(e) {
  isResizing.value = true
  startX = (e.touches ? e.touches[0].clientX : e.clientX)
  startWidth = sidebarRightWidth.value
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', onResizeEnd)
  window.addEventListener('touchmove', onResize, { passive: false })
  window.addEventListener('touchend', onResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onResize(e) {
  if (!isResizing.value) return
  const clientX = (e.touches ? e.touches[0].clientX : e.clientX)
  const delta = clientX - startX
  const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth - delta))
  sidebarRightWidth.value = next
  // Nudge listeners (e.g., map) to recalc layout
  window.dispatchEvent(new Event('resize'))
}

function onResizeEnd() {
  if (!isResizing.value) return
  isResizing.value = false
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', onResizeEnd)
  window.removeEventListener('touchmove', onResize)
  window.removeEventListener('touchend', onResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.dispatchEvent(new Event('resize'))
}

onBeforeUnmount(() => {
  if (isResizing.value) onResizeEnd()
})
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>🌍 WCity - NASA Environmental Data Viewer</h1>
      <p>Interactive city suitability analysis using NASA satellite data</p>
    </header>

    <div class="main-layout" :style="{ '--sidebar-right-width': sidebarRightWidth + 'px' }">
      <aside class="sidebar-left">
        <LayerControls />
      </aside>

      <main class="map-section">
        <MapView />
      </main>

      <div class="resizer" @mousedown="onResizeStart" @touchstart.prevent="onResizeStart"></div>

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
  position: relative;
}

.app-header::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.12); /* subtle contrast overlay for readability */
  pointer-events: none;
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
  font-size: 28px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.2px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.25);
  margin: 0 0 5px 0;
}

.app-header p {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1.45;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  margin: 0;
}

.main-layout {
  display: grid;
  grid-template-columns: 300px 1fr 5px var(--sidebar-right-width);
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

.resizer {
  cursor: col-resize;
  background: linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.1));
  border-radius: 4px;
  width: 5px;
}

@media (max-width: 1200px) {
  .main-layout {
    grid-template-columns: 250px 1fr 5px var(--sidebar-right-width);
  }
}

@media (max-width: 768px) {
  .main-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }

  .resizer {
    display: none;
  }

  .sidebar-left,
  .sidebar-right {
    max-height: 200px;
  }
}
</style>
