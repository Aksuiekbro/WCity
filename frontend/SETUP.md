# Frontend Setup Instructions

## Dependencies to Install

Due to network issues during setup, please run the following command to install required dependencies:

```bash
cd frontend
npm install leaflet axios pinia
npm install --save-dev @types/leaflet
```

## Required Dependencies
- **leaflet** - Interactive map library
- **axios** - HTTP client for API calls
- **pinia** - State management for Vue 3
- **@types/leaflet** - TypeScript types for Leaflet

## Running the Frontend

After installing dependencies:

```bash
npm run dev
```

The frontend will run on `http://localhost:5173` (or 5174 if 5173 is taken).

## Running the Backend

In a separate terminal:

```bash
cd backend
npm run start:dev
```

The backend will run on `http://localhost:3000`.

## Features

- **Interactive Map** - Click anywhere to get city suitability scores
- **Layer Toggles** - Show/hide different environmental data layers
- **Real-time Scores** - View air quality, vegetation, temperature, water, and urbanization scores
- **NASA Data Integration** - Uses real NASA environmental data APIs
