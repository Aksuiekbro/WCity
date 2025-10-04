You already have most of the building blocks for this idea (environment scores, population, OSM infrastructure, OpenAI). The missing piece is a “planning” layer that works on many locations at once instead of a single point.

Here’s how I’d evolve the idea.

1. Clarify the new feature

Goal: “Given a city/viewport and current infrastructure, suggest new locations for infrastructure (e.g. shelters, hospitals, drainage) focusing on areas most susceptible to natural disasters.”
Inputs from user:
Hazard types: floods, heatwaves, landslides, wildfires, etc.
Infrastructure type: flood shelters, hospitals, cooling centers, fire stations, etc.
Constraints: max number of sites, budget level, max distance to population centers.
2. Backend data pipeline (before GPT)

Use your existing services to build a risk & coverage map over a viewport:

Sample a grid over the map (e.g. every 0.01° or similar), for each grid cell:
Environmental vulnerability: from ScoringService + NASA services (e.g. extreme rainfall, soil moisture anomalies, temperature extremes as proxies for flood/heat risk).
Exposure: from SedacService population density.
Current coverage: distance to nearest relevant infrastructure using OverpassService results (hospitals, shelters, schools, etc.).
Compute simple numeric scores per cell, for example:
hazard_score (how bad it is if disaster hits here).
exposure_score (how many people live here).
underserved_score (far from existing infra).
Combine into priority_score = hazard * exposure * underserved (normalized).
Keep only top N candidate cells (e.g. 50–200) to avoid overloading GPT.
3. Let GPT do high‑level planning, not raw geospatial

Instead of dumping all raw API data, send GPT a compressed, structured view of the risk map:

Create a new NestJS service, e.g. PlanningService, with a method like suggestInfrastructureSites(viewport, infraType, hazardTypes).

Build a prompt like:

System: “You are an expert urban planner and disaster‑risk specialist. You receive a list of candidate locations with risk, population, and service coverage. Your task is to select the best new infrastructure locations and justify them.”

User content (JSON‑ish summary), for example:

General context: city/region name, hazard types, total population, description of existing infra.
For each top candidate cell: { id, lat, lng, hazard_score, exposure_score, underserved_score, nearest_infra_distance_km, notes }.
Ask GPT: “Pick up to K locations for new [infrastructure type] that most reduce disaster risk. For each, return: id, lat, lng, priority (high/medium/low), and 1–2 sentence rationale.”
Response format: require strict JSON so you can parse it:

Return ONLY valid JSON:
{
  "suggestions": [
    {
      "id": "...",
      "lat": ...,
      "lng": ...,
      "priority": "high" | "medium" | "low",
      "hazards": ["flood"],
      "suggested_infrastructure": "flood evacuation shelter",
      "reason": "..."
    }
  ],
  "summary": "High-level explanation..."
}
Implement this similar to your existing InfrastructureService.generateRecommendations, but taking an array of candidate cells instead of a single LocationScores.

4. New API endpoint design

Add a planning endpoint in your MapController:

POST /map/planning/recommendations
Body:
viewport: { north, south, east, west }
infrastructureType: "shelter" | "hospital" | "cooling_center" | ...
hazards: ["flood", "heatwave", ...]
maxSuggestions: number
Flow:
Build grid + risk/coverage metrics (using existing NASA + Overpass + scoring).
Select top candidate cells.
Call PlanningService (GPT) to pick and explain best sites.
Respond with JSON: { suggestions, summary, debugInfo? }.
5. Frontend UX

Add a new “AI Planning” mode in the map UI:
User selects hazard(s) + infra type + max number of suggestions.
Call apiClient for /map/planning/recommendations.
On response:
Place markers for suggested sites (color by priority).
On click, show GPT’s explanation: why this spot is disaster‑susceptible and what infrastructure is recommended.
Optionally overlay risk heatmap from your own numeric scores so users can see why GPT chose those spots.
6. Natural‑disaster focus

To better target disasters, you can:

Floods: use extreme rainfall, soil moisture, low elevation/proximity to rivers (from external datasets or heuristics) to boost hazard_score in valleys/river plains.
Heatwaves: use high temperature anomalies + low vegetation + high population as risk factors for “cooling centers”.
Landslides: combine slope (from elevation), soil moisture, and rainfall.
Wildfires: low moisture + high vegetation + proximity to settlements.
GPT then reasons on top of these pre‑computed hazard indicators to prioritize where limited infrastructure gives the most risk reduction.