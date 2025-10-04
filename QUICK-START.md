# 🚀 Quick Start Guide - CitySense

## ✅ Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js 20+ installed (check: `node --version`)
- ✅ npm installed (check: `npm --version`)
- ✅ Git installed (check: `git --version`)

## 🏃 Fast Start (3 Commands)

### Option 1: Using npm scripts (from root)
```bash
# Install all dependencies (if not done)
npm install

# Start both backend and frontend
npm run dev
```

### Option 2: Manual start (separate terminals)

**Terminal 1 - Backend:**
```bash
cd backend
npm run start:dev
```
✅ Backend ready on `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
✅ Frontend ready on `http://localhost:5173`

## 🎯 Verify It's Working

### 1. Check Backend Health
```bash
curl http://localhost:3000
# Should return: "Hello World!"
```

### 2. Test Location Score API
```bash
curl "http://localhost:3000/api/map/score?lat=40.7128&lng=-74.006"
# Should return JSON with scores
```

### 3. Open Frontend
Open browser: `http://localhost:5173`

**You should see:**
- ✅ Map centered on NYC
- ✅ Left sidebar with "NASA Data Layers"
- ✅ Right sidebar with "Location Analysis"
- ✅ Header: "CitySense - NASA Environmental Data Viewer"

## 🧪 Test the Features

### Test 1: Toggle NASA GIBS Layers
1. Click "Air Quality (AOD)" toggle in left sidebar
2. **Expected:** Semi-transparent pollution heatmap appears on map
3. **Expected:** Legend appears showing color scale (0 → 1.0 AOD)
4. **Expected:** Date shown (e.g., "📅 Oct 1, 2025")

### Test 2: Get Location Scores
1. Click anywhere on the map (try NYC: 40.7128, -74.006)
2. **Expected:** Marker appears at clicked location
3. **Expected:** Loading spinner appears briefly
4. **Expected:** Right panel fills with scores:
   - Overall score (0-100)
   - Grade (A+ to F)
   - Air Quality, Vegetation, Temperature, Water, Urbanization scores
5. **Expected:** Popup on marker shows grade

### Test 3: Multiple Layers
1. Toggle multiple layers: Air Quality + Vegetation
2. **Expected:** Both layers visible as overlays
3. **Expected:** Both legends shown in left sidebar
4. Click map → **Expected:** Scores update normally

## 🐛 Troubleshooting

### Issue: "Cannot find module" errors

**Solution:**
```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Issue: Backend won't start (TS errors)

**Check:** TypeScript compilation
```bash
cd backend
npm run build
```

**Common fix:** Make sure all dependencies are installed
```bash
npm install @nestjs/axios @nestjs/config @nestjs/cache-manager cache-manager axios
```

### Issue: Frontend won't start (Vite errors)

**Check:** Dependencies are installed
```bash
cd frontend
npm list leaflet axios pinia
```

**Fix if missing:**
```bash
npm install leaflet axios pinia
npm install --save-dev @types/leaflet
```

### Issue: Map doesn't show

**Check browser console** (F12) for errors:
- ❌ `Leaflet is not defined` → Missing leaflet dependency
- ❌ `CORS error` → Backend not running or CORS not enabled
- ❌ `404 on tiles` → Normal! GIBS tiles may have 1-3 day delay

### Issue: GIBS layers don't appear

**Solutions:**
1. **Wait 2-3 seconds** - Tiles take time to load
2. **Check browser Network tab** - Look for requests to `gibs.earthdata.nasa.gov`
3. **Zoom out** - Some layers only appear at certain zoom levels
4. **Check date** - Tiles use 2 days ago, verify in console logs

### Issue: Scores show "Failed to fetch"

**Check:**
1. Backend is running on `http://localhost:3000`
2. CORS is enabled (already done in code)
3. Test API directly: `curl "http://localhost:3000/api/map/score?lat=40&lng=-74"`

## 📊 Expected Console Output

### Backend (Terminal 1)
```
[Nest] 12345  - 10/04/2025, 7:54:45 PM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 10/04/2025, 7:54:45 PM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 12345  - 10/04/2025, 7:54:45 PM     LOG [InstanceLoader] MapModule dependencies initialized
[Nest] 12345  - 10/04/2025, 7:54:45 PM     LOG [RoutesResolver] MapController {/api/map}:
[Nest] 12345  - 10/04/2025, 7:54:45 PM     LOG [RouterExplorer] Mapped {/api/map/score, GET} route
🚀 Backend running on http://localhost:3000
```

### Frontend (Terminal 2)
```
  VITE v7.1.7  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### Browser Console
When you toggle a layer, you should see:
```
Added NASA GIBS layer: airQuality
```

When you click the map:
```
Fetching scores for: {lat: 40.7128, lng: -74.006}
```

## 🎉 Success Checklist

After following this guide, you should have:

- [x] Backend running on port 3000
- [x] Frontend running on port 5173
- [x] Map displays with OpenStreetMap base layer
- [x] Can toggle NASA GIBS layers (see overlays)
- [x] Can click map to get location scores
- [x] Scores display in right panel
- [x] Legends show for active layers
- [x] No errors in browser console (except maybe GIBS tile 404s)

## 🆘 Still Having Issues?

### Check System Requirements
```bash
node --version   # Should be v20+ or v22+
npm --version    # Should be 9+ or 10+
```

### Verify Project Structure
```bash
ls backend/src/nasa/services/    # Should show *.service.ts files
ls frontend/src/components/      # Should show MapView.vue, etc.
ls frontend/node_modules/leaflet # Should exist
```

### Clean Rebuild Everything
```bash
# From project root
rm -rf backend/node_modules backend/dist
rm -rf frontend/node_modules frontend/dist

cd backend && npm install && npm run build
cd ../frontend && npm install

# Then start normally
```

### Check Ports Not in Use
```bash
# Check if port 3000 is free
lsof -i :3000

# Check if port 5173 is free
lsof -i :5173

# Kill process if needed (replace PID)
kill -9 <PID>
```

## 🔗 Helpful Resources

- **Main README:** `/README.md`
- **GIBS Guide:** `/docs/GIBS-LAYERS.md`
- **Setup Instructions:** `/frontend/SETUP.md`
- **Implementation Summary:** `/GIBS-INTEGRATION-SUMMARY.md`

## 💡 Pro Tips

1. **Keep both terminals visible** - See real-time logs from backend and frontend
2. **Use browser DevTools** - Network tab shows GIBS tile requests
3. **Check browser console** - Look for layer toggle confirmations
4. **Try different locations** - Compare NYC vs Amazon rainforest vs Sahara
5. **Toggle multiple layers** - See combined data overlays

---

**Ready to demo! 🚀**

If everything works, you should have a fully functional NASA data visualization app perfect for your hackathon presentation!
