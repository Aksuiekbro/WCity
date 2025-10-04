# 🗺️ Map Not Showing - Troubleshooting Guide

## ❓ Issue: "Location Analysis" panel shows but no map appears

### Quick Checklist

1. **Open Browser DevTools**
   - Press `F12` or `Cmd+Option+I` (Mac)
   - Go to **Console** tab
   - Look for red errors

2. **Check if servers are running**
   ```bash
   # Check backend (should show processes)
   lsof -i :3000

   # Check frontend (should show processes)
   lsof -i :5173
   # or
   lsof -i :5174
   ```

3. **Verify the correct URL**
   - Frontend: `http://localhost:5173` or `http://localhost:5174`
   - NOT `http://localhost:3000` (that's the backend API)

### Common Errors & Solutions

#### Error 1: "Leaflet is not defined"
```
Uncaught ReferenceError: L is not defined
```

**Solution:**
```bash
cd frontend
npm install leaflet
npm install --save-dev @types/leaflet
```

#### Error 2: Missing Leaflet CSS
**Symptom:** Map container is blank/white, no tiles

**Solution:** Already fixed in `MapView.vue` with:
```typescript
import 'leaflet/dist/leaflet.css';
```

If still not working, check browser Network tab for 404 on `leaflet.css`

#### Error 3: "Cannot read property 'map' of null"
**Symptom:** Error about `mapContainer.value` being null

**Solution:** Map container ref not binding correctly. Verify the template has:
```vue
<div ref="mapContainer" class="map-container"></div>
```

#### Error 4: Map shows but is tiny (small gray box)
**Symptom:** Map is only 20-30px high

**Solution:** Height not set correctly. Check:
1. `.map-wrapper` has `height: 100%`
2. `.map-container` has `height: 100%`
3. `.map-section` (parent) has proper height from grid

#### Error 5: "Invalid LatLng object"
**Symptom:** Map doesn't initialize

**Solution:** Check MapView.vue line 22:
```typescript
map = L.map(mapContainer.value).setView([40.7128, -74.006], 10);
```
Ensure coordinates are valid numbers

### Browser Console Checks

#### ✅ What you SHOULD see:
```
Vue DevTools: Detected Vue...
[HMR] Waiting for update signal from WDS...
```

#### ❌ What you should NOT see:
```
Error: Map container not found
Failed to fetch
CORS error
Leaflet is not defined
Cannot import module
```

### Visual Debugging

#### Expected Layout:
```
+--------------------------------------------------+
| 🌍 CitySense - NASA Environmental Data Viewer  |
+--------+-------------------------+---------------+
| NASA   |                         | Location      |
| Data   |    [MAP SHOULD BE       | Analysis      |
| Layers |     HERE - OpenStreet   |               |
|        |     Map tiles visible]  | 📍 Click      |
|        |                         | anywhere...   |
+--------+-------------------------+---------------+
```

#### If you see:
```
+--------+-------------------------+---------------+
| NASA   |                         | Location      |
| Layers | [BLANK/WHITE SPACE]     | Analysis      |
+--------+-------------------------+---------------+
```

**Problem:** Map container exists but Leaflet map not initializing

### Step-by-Step Diagnosis

1. **Open http://localhost:5174**

2. **Open DevTools Console** (F12)

3. **Type these commands:**
   ```javascript
   // Check if Leaflet is loaded
   typeof L
   // Should return: "object"

   // Check if Vue app mounted
   document.querySelector('.map-container')
   // Should return: HTMLDivElement

   // Check map container dimensions
   const container = document.querySelector('.map-container');
   console.log('Width:', container?.offsetWidth, 'Height:', container?.offsetHeight);
   // Should show: Width: ~800-1200 Height: ~600-800 (not 0!)
   ```

4. **Check Network Tab:**
   - Filter: `tile.openstreetmap.org`
   - Should see requests for PNG tiles
   - If no requests → Map not initializing
   - If 404 errors → Normal (some tiles may be missing)

5. **Check Elements Tab:**
   - Find: `<div class="map-container">`
   - Should contain: `<div class="leaflet-container">`
   - If leaflet-container missing → Leaflet didn't initialize

### Manual Fix: Restart Everything

```bash
# Kill all processes
pkill -f "vite"
pkill -f "nest"

# Clean restart
cd backend
npm run start:dev

# New terminal
cd frontend
rm -rf node_modules/.vite  # Clear Vite cache
npm run dev
```

### Check Dependencies

```bash
cd frontend
npm list | grep -E "leaflet|axios|pinia"
```

**Expected output:**
```
├── @types/leaflet@1.9.14
├── axios@1.7.7
├── leaflet@1.9.4
└── pinia@2.2.8
```

### Verify Files Exist

```bash
ls -l frontend/src/components/MapView.vue
ls -l frontend/node_modules/leaflet/dist/leaflet.css
ls -l frontend/node_modules/leaflet/dist/leaflet.js
```

All should exist (not "No such file")

### Test in Isolation

Create a test file: `frontend/test-leaflet.html`

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>#map { height: 500px; width: 100%; }</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([40.7128, -74.006], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  </script>
</body>
</html>
```

**Open in browser:** If this works → Issue is with Vue integration. If this fails → Browser/system issue.

### Still Not Working?

**Share these debug details:**

1. Browser console errors (full text)
2. Network tab screenshot
3. Elements tab showing `<div class="map-container">` contents
4. Output of:
   ```bash
   cd frontend
   npm list leaflet axios pinia vue
   node --version
   npm --version
   ```

### Last Resort: Nuclear Option

```bash
# Complete clean reinstall
cd /Users/daurenzhunussov/WCity

# Backend
cd backend
rm -rf node_modules package-lock.json dist
npm install
npm run build

# Frontend
cd ../frontend
rm -rf node_modules package-lock.json dist .vite
npm install

# Restart
cd ../backend && npm run start:dev &
cd ../frontend && npm run dev
```

---

## Quick Reference

**Working app should show:**
- ✅ Map tiles loading (OpenStreetMap)
- ✅ Zoom controls (+ / - buttons top-left)
- ✅ Click on map → marker appears
- ✅ Toggle layers → overlays appear
- ✅ No console errors (except maybe GIBS 404s)

**If map is completely missing:**
1. Check console for errors
2. Verify container has height > 0
3. Check Leaflet is imported
4. Verify servers are running
5. Try hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
