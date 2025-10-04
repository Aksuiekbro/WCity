# Deployment Guide

This guide covers deploying both the frontend and backend together.

## Option 1: Railway (Recommended - Easiest for Full-Stack)

Railway can deploy both backend and frontend from the same repo.

### Steps:

1. **Go to [Railway.app](https://railway.app)** and sign in with GitHub
2. **New Project** → **Deploy from GitHub repo** → Select `WCity`
3. **Add Service** → **GitHub Repo** → Select your repo
4. **Configure Backend Service:**
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
   - Add Environment Variables:
     ```
     PORT=3000
     GEONAMES_USERNAME=your_geonames_username
     NASA_EARTHDATA_USERNAME=your_earthdata_username
     NASA_EARTHDATA_PASSWORD=your_earthdata_password
     OPENAI_API_KEY=your_openai_api_key
     FRONTEND_URL=https://your-frontend-domain.railway.app
     ```
5. **Add Frontend Service:**
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npx serve -s dist -l 3000` (or use Railway's static file serving)
   - Add Environment Variable:
     ```
     VITE_API_BASE_URL=https://your-backend-service.railway.app/api
     ```
6. **Get Backend URL** from Railway (e.g., `https://wcity-backend.railway.app`)
7. **Update Frontend Environment Variable** with the backend URL
8. **Redeploy Frontend**

Railway will give you URLs for both services. Point the frontend's `VITE_API_BASE_URL` to the backend URL.

---

## Option 2: Render (Recommended for Full-Stack)

### Step 1: Deploy Backend (Web Service)

1. **Go to [Render.com](https://render.com)** and sign in with GitHub
2. **New +** → **Web Service**
3. **Connect your GitHub repository** → Select `WCity` repo
4. **Configure the service:**
   - **Name:** `wcity-backend` (or any name you prefer)
   - **Region:** Choose closest to your users (Virginia is shown in your screen)
   - **Branch:** `main` (or your default branch)
   - **Root Directory:** `backend` ⚠️ **Important!**
   - **Runtime:** **Node** ✅ (you've already selected this)
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start:prod`
   - **Node Version:** `20` or `22` (matches your `package.json` engines requirement)

5. **Environment Variables** (click "Advanced" → "Add Environment Variable"):
   ```
   GEONAMES_USERNAME=your_geonames_username
   NASA_EARTHDATA_USERNAME=your_earthdata_username (optional)
   NASA_EARTHDATA_PASSWORD=your_earthdata_password (optional)
   OPENAI_API_KEY=your_openai_api_key (optional)
   FRONTEND_URL=https://wcity-frontend.onrender.com
   ```
   ⚠️ **Note:** 
   - You'll update `FRONTEND_URL` after deploying the frontend
   - **Don't set `PORT`** - Render automatically sets this for you

6. **Click "Create Web Service"**
7. **Wait for deployment** - Render will build and deploy your backend
8. **Copy the backend URL** (e.g., `https://wcity-backend.onrender.com`)

### Step 2: Deploy Frontend (Static Site)

1. **In Render dashboard:** **New +** → **Static Site**
2. **Connect your GitHub repository** → Select `WCity` repo
3. **Configure the static site:**
   - **Name:** `wcity-frontend` (or any name you prefer)
   - **Branch:** `main` (or your default branch)
   - **Root Directory:** `frontend` ⚠️ **Important!**
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`

4. **Environment Variables:**
   ```
   VITE_API_BASE_URL=https://wcity-backend.onrender.com/api
   ```
   ⚠️ **Use the actual backend URL from Step 1!**

5. **Click "Create Static Site"**
6. **Wait for deployment**

### Step 3: Update Backend CORS

1. **Go back to your backend service** in Render dashboard
2. **Environment** tab → **Edit Environment Variables**
3. **Update `FRONTEND_URL`** to your frontend URL (e.g., `https://wcity-frontend.onrender.com`)
4. **Save Changes** - Render will automatically redeploy

### Step 4: Verify Deployment

1. **Test Backend:** Visit `https://your-backend.onrender.com/api/map/score?lat=40.7128&lng=-74.006`
2. **Test Frontend:** Visit your frontend URL
3. **Check Browser Console** for any CORS or API errors

---

### Render Configuration Summary

**Backend (Web Service):**
- Runtime: **Node** ✅
- Root Directory: `backend`
- Build: `npm install && npm run build`
- Start: `npm run start:prod`

**Frontend (Static Site):**
- Root Directory: `frontend`
- Build: `npm install && npm run build`
- Publish: `dist`

---

## Option 3: Vercel (Frontend) + Railway/Render (Backend)

### Deploy Frontend on Vercel:

1. **In Vercel deployment screen:**
   - Framework Preset: **Vue.js** ✅
   - Root Directory: **`./frontend`** (change from `./`)
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `dist` (auto-detected)

2. **Environment Variables in Vercel:**
   - Add: `VITE_API_BASE_URL` = `https://your-backend-url.railway.app/api`
   - (You'll add this after deploying the backend)

3. **Deploy Backend on Railway/Render:**
   - Follow Option 1 or 2 above for backend
   - Get the backend URL
   - Update `VITE_API_BASE_URL` in Vercel with the backend URL
   - Redeploy frontend

---

## Option 4: Fly.io (Full-Stack)

1. **Install Fly CLI:** `curl -L https://fly.io/install.sh | sh`
2. **Create `fly.toml` for backend** (in `backend/` directory)
3. **Deploy backend:** `fly deploy` from `backend/` directory
4. **Deploy frontend:** Create another Fly app for frontend

---

## Important Notes:

### Backend CORS Configuration

The backend is already configured to accept requests from:
- `localhost:5173` and `localhost:5174` (dev)
- `FRONTEND_URL` environment variable (production)

Make sure to set `FRONTEND_URL` in your backend deployment to your frontend's production URL.

### Environment Variables Checklist

**Backend needs:**
- `PORT` (auto-set by Render - don't set manually)
- `GEONAMES_USERNAME` (required)
- `NASA_EARTHDATA_USERNAME` (optional)
- `NASA_EARTHDATA_PASSWORD` (optional)
- `OPENAI_API_KEY` (optional)
- `FRONTEND_URL` (your frontend production URL)

**Frontend needs:**
- `VITE_API_BASE_URL` (your backend production URL + `/api`)

### Testing After Deployment

1. Check backend health: `https://your-backend-url.com/api/map/score?lat=40.7128&lng=-74.006`
2. Check frontend loads and can call backend
3. Verify CORS is working (check browser console)

---

## Quick Deploy Commands (Railway CLI)

If using Railway CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy backend
cd backend
railway init
railway up

# Deploy frontend (new terminal)
cd frontend
railway init
railway up
```

---

## Troubleshooting

**CORS Errors:**
- Make sure `FRONTEND_URL` in backend matches your frontend domain exactly
- Check that backend CORS includes your frontend URL

**API Not Found:**
- Verify `VITE_API_BASE_URL` is set correctly in frontend
- Check that backend is running and accessible
- Ensure backend URL includes `/api` prefix

**Build Failures:**
- Make sure Node.js version matches (20.19.0+ or 22.12.0+)
- Check that all dependencies are in `package.json`

