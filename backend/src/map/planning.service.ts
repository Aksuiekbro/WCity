import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ScoringService, LocationScores } from '../data/scoring.service';
import { OverpassService } from '../data/overpass.service';

export interface PlanningViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface PlanningConstraints {
  maxDistanceKm?: number;
  budgetLevel?: 'low' | 'medium' | 'high';
  maxSites?: number;
}

export interface PlanningRequest {
  viewport: PlanningViewport;
  infrastructureType: string;
  hazards: string[];
  maxSuggestions: number;
  constraints: PlanningConstraints;
  includeDebug?: boolean;
}

export interface PlanningSuggestion {
  id: string;
  lat: number;
  lng: number;
  priority: 'high' | 'medium' | 'low';
  hazards: string[];
  suggested_infrastructure: string;
  reason: string;
}

export interface PlanningResponse {
  suggestions: PlanningSuggestion[];
  summary: string;
  generatedAt: string;
  context: {
    viewport: PlanningViewport;
    infrastructureType: string;
    hazards: string[];
    maxSuggestions: number;
    constraints: PlanningConstraints;
  };
  debug?: {
    candidateCount: number;
    sampledPoints: number;
    topCandidatesPreview: CandidateCell[];
  };
}

interface CandidateCell {
  id: string;
  lat: number;
  lng: number;
  hazardScore: number;
  hazardBreakdown: Record<string, number>;
  exposureScore: number;
  underservedScore: number;
  priorityScore: number;
  nearestInfrastructureKm: number | null;
  metrics: {
    populationDensity: number;
    temperatureC: number;
    soilMoisture: number;
  };
  notes: string;
}

@Injectable()
export class PlanningService {
  private readonly logger = new Logger(PlanningService.name);
  private readonly GRID_STEPS = 7; // 7x7 grid = 49 candidate cells by default
  private readonly MAX_CANDIDATES_FOR_LLM = 60;
  private readonly MIN_PRIORITY_THRESHOLD = 0.05;
  private openai: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly scoringService: ScoringService,
    private readonly overpassService: OverpassService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn('OPENAI_API_KEY not set - planning suggestions will use heuristic fallback');
    }
  }

  async suggestInfrastructureSites(request: PlanningRequest): Promise<PlanningResponse> {
    const sanitizedRequest = this.sanitizeRequest(request);
    const gridPoints = this.sampleGrid(sanitizedRequest.viewport);

    const infraPois = await this.fetchInfrastructurePoints(
      sanitizedRequest.infrastructureType,
      sanitizedRequest.viewport,
    );

    const candidates = await this.buildCandidates(
      gridPoints,
      sanitizedRequest.hazards,
      infraPois,
      sanitizedRequest.constraints,
    );

    const prioritized = candidates
      .filter((cell) => cell.priorityScore >= this.MIN_PRIORITY_THRESHOLD)
      .sort((a, b) => b.priorityScore - a.priorityScore);

    const llmInput = prioritized.slice(0, this.MAX_CANDIDATES_FOR_LLM);

    const { suggestions, summary } = await this.getSuggestionsFromLLM(
      sanitizedRequest,
      llmInput,
    );

    const response: PlanningResponse = {
      suggestions,
      summary,
      generatedAt: new Date().toISOString(),
      context: {
        viewport: sanitizedRequest.viewport,
        infrastructureType: sanitizedRequest.infrastructureType,
        hazards: sanitizedRequest.hazards,
        maxSuggestions: sanitizedRequest.maxSuggestions,
        constraints: sanitizedRequest.constraints,
      },
    };

    if (sanitizedRequest.includeDebug) {
      response.debug = {
        candidateCount: prioritized.length,
        sampledPoints: gridPoints.length,
        topCandidatesPreview: prioritized.slice(0, 5),
      };
    }

    return response;
  }

  private sanitizeRequest(request: PlanningRequest): PlanningRequest {
    const constraints: PlanningConstraints = {
      maxDistanceKm:
        typeof request.constraints?.maxDistanceKm === 'number'
          ? Math.max(1, request.constraints.maxDistanceKm)
          : 8,
      budgetLevel: request.constraints?.budgetLevel || 'medium',
      maxSites: request.constraints?.maxSites,
    };

    const hazards = Array.isArray(request.hazards)
      ? request.hazards.filter((h) => typeof h === 'string' && h.trim().length > 0).map((h) => h.toLowerCase())
      : [];

    return {
      viewport: {
        north: Math.min(90, Math.max(-90, request.viewport.north)),
        south: Math.min(90, Math.max(-90, request.viewport.south)),
        east: Math.min(180, Math.max(-180, request.viewport.east)),
        west: Math.min(180, Math.max(-180, request.viewport.west)),
      },
      infrastructureType: request.infrastructureType || 'shelter',
      hazards: hazards.length ? hazards : ['flood'],
      maxSuggestions: Math.min(10, Math.max(1, request.maxSuggestions || 5)),
      constraints,
      includeDebug: request.includeDebug ?? false,
    };
  }

  private sampleGrid(viewport: PlanningViewport): { lat: number; lng: number }[] {
    const points: { lat: number; lng: number }[] = [];
    const latRange = viewport.north - viewport.south;
    const lngRange = viewport.east - viewport.west;

    const latStep = this.GRID_STEPS > 1 ? latRange / (this.GRID_STEPS - 1) : latRange;
    const lngStep = this.GRID_STEPS > 1 ? lngRange / (this.GRID_STEPS - 1) : lngRange;

    for (let i = 0; i < this.GRID_STEPS; i++) {
      const lat = viewport.south + latStep * i;
      for (let j = 0; j < this.GRID_STEPS; j++) {
        const lng = viewport.west + lngStep * j;
        points.push({ lat, lng });
      }
    }
    return points;
  }

  private async fetchInfrastructurePoints(
    type: string,
    viewport: PlanningViewport,
  ) {
    const normalizedType = type?.toLowerCase() || 'shelter';
    switch (normalizedType) {
      case 'hospital':
      case 'hospitals':
        return this.overpassService.getHospitalsInViewport(viewport);
      case 'school':
      case 'schools':
        return this.overpassService.getSchoolsInViewport(viewport);
      case 'fire_station':
      case 'fire_stations':
        return this.overpassService.getFireStationsInViewport(viewport);
      case 'police':
        return this.overpassService.getPoliceInViewport(viewport);
      case 'power_plants':
      case 'power':
        return this.overpassService.getPowerPlantsInViewport(viewport);
      case 'cooling_center':
      case 'cooling_centers':
        return this.overpassService.getInfrastructureByTag(
          viewport,
          'amenity',
          'community_centre',
          'cooling_center',
        );
      case 'shelter':
      case 'shelters':
        return this.overpassService.getInfrastructureByTag(
          viewport,
          'amenity',
          'shelter',
          'shelter',
        );
      case 'drainage':
      case 'drainage_hub':
      case 'pumping_station':
        return this.overpassService.getInfrastructureByTag(
          viewport,
          'man_made',
          'pumping_station',
          'drainage',
        );
      default:
        // Fallback to hospitals for coverage calculations
        return this.overpassService.getHospitalsInViewport(viewport);
    }
  }

  private async buildCandidates(
    gridPoints: { lat: number; lng: number }[],
    hazards: string[],
    infraPois: { lat: number; lng: number }[],
    constraints: PlanningConstraints,
  ): Promise<CandidateCell[]> {
    const nearestDistanceCache = new Map<string, number>();

    const candidatePromises = gridPoints.map(async (point, index) => {
      const scores = await this.scoringService.calculateScores(point.lat, point.lng);
      const hazardBreakdown = this.computeHazardBreakdown(scores, hazards);
      const hazardScore = this.average(Object.values(hazardBreakdown));
      const exposureScore = this.computeExposureScore(scores);

      const distanceKey = `${point.lat.toFixed(3)}_${point.lng.toFixed(3)}`;
      let nearestDistance = nearestDistanceCache.get(distanceKey) ?? null;
      if (nearestDistance === null) {
        nearestDistance = this.findNearestInfrastructure(point, infraPois);
        if (nearestDistance !== null) {
          nearestDistanceCache.set(distanceKey, nearestDistance);
        }
      }

      const underservedScore = this.computeUnderservedScore(
        nearestDistance,
        constraints.maxDistanceKm || 8,
      );

      const priorityScore = hazardScore * exposureScore * underservedScore;

      return {
        id: `cell_${index}`,
        lat: point.lat,
        lng: point.lng,
        hazardScore,
        hazardBreakdown,
        exposureScore,
        underservedScore,
        priorityScore,
        nearestInfrastructureKm: nearestDistance,
        metrics: {
          populationDensity: scores.scores.urbanization.populationDensity,
          temperatureC: scores.scores.temperature.current,
          soilMoisture: scores.scores.water.soilMoisture,
        },
        notes: this.buildCandidateNotes(scores, nearestDistance, constraints.maxDistanceKm || 8),
      };
    });

    return Promise.all(candidatePromises);
  }

  private computeHazardBreakdown(
    scores: LocationScores,
    hazards: string[],
  ): Record<string, number> {
    const breakdown: Record<string, number> = {};
    const uniqueHazards = hazards.length ? hazards : ['flood'];

    uniqueHazards.forEach((hazard) => {
      switch (hazard) {
        case 'flood':
          breakdown[hazard] = this.clamp(
            (scores.scores.water.soilMoisture - 0.25) / 0.45,
          );
          break;
        case 'heatwave':
          breakdown[hazard] = this.clamp(
            0.6 * Math.max(0, (scores.scores.temperature.current - 28) / 18) +
              0.4 * (1 - scores.scores.water.score / 100),
          );
          break;
        case 'landslide':
          breakdown[hazard] = this.clamp(
            0.6 * (scores.scores.water.soilMoisture - 0.3) / 0.4 +
              0.4 * (1 - scores.scores.vegetation.score / 100),
          );
          break;
        case 'wildfire':
          breakdown[hazard] = this.clamp(
            0.4 * (scores.scores.vegetation.score / 100) +
              0.4 * (1 - scores.scores.water.score / 100) +
              0.2 * Math.max(0, (scores.scores.temperature.current - 25) / 15),
          );
          break;
        default:
          breakdown[hazard] = 0.35; // Neutral risk for unknown hazards
      }
    });

    return breakdown;
  }

  private computeExposureScore(scores: LocationScores): number {
    const density = scores.scores.urbanization.populationDensity;
    const logDensity = Math.log10(density + 1);
    const normalized = logDensity / 4; // ~10,000 people/km² == 1.0
    return this.clamp(normalized);
  }

  private computeUnderservedScore(distanceKm: number | null, maxDistanceKm: number): number {
    if (distanceKm === null) {
      return 1; // No infrastructure available
    }
    return this.clamp(distanceKm / maxDistanceKm);
  }

  private findNearestInfrastructure(
    point: { lat: number; lng: number },
    infraPois: { lat: number; lng: number }[],
  ): number | null {
    if (!infraPois || infraPois.length === 0) {
      return null;
    }
    let minDistance = Number.POSITIVE_INFINITY;
    infraPois.forEach((poi) => {
      const dist = this.haversineDistance(point.lat, point.lng, poi.lat, poi.lng);
      if (dist < minDistance) {
        minDistance = dist;
      }
    });
    return minDistance === Number.POSITIVE_INFINITY ? null : minDistance;
  }

  private buildCandidateNotes(
    scores: LocationScores,
    distance: number | null,
    targetDistance: number,
  ): string {
    const pop = scores.scores.urbanization.populationDensity;
    const distanceText = distance === null ? 'no nearby infrastructure' : `${distance.toFixed(1)}km to nearest site`;
    return `Pop density ${Math.round(pop)} ppl/km², ${distanceText}, target coverage ${targetDistance}km`;
  }

  private async getSuggestionsFromLLM(
    request: PlanningRequest,
    candidates: CandidateCell[],
  ): Promise<{ suggestions: PlanningSuggestion[]; summary: string }> {
    if (!this.openai || candidates.length === 0) {
      return this.buildFallbackSuggestions(request, candidates);
    }

    const contextPayload = {
      cityViewport: request.viewport,
      hazards: request.hazards,
      infrastructureType: request.infrastructureType,
      constraints: request.constraints,
      candidates: candidates.map((c) => ({
        id: c.id,
        lat: c.lat,
        lng: c.lng,
        hazard_score: Number(c.hazardScore.toFixed(2)),
        hazard_breakdown: c.hazardBreakdown,
        exposure_score: Number(c.exposureScore.toFixed(2)),
        underserved_score: Number(c.underservedScore.toFixed(2)),
        priority_score: Number(c.priorityScore.toFixed(2)),
        nearest_infra_km: c.nearestInfrastructureKm,
        notes: c.notes,
      })),
      maxSuggestions: request.maxSuggestions,
    };

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 900,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert urban planner and disaster-risk specialist. Review structured candidate locations and select the best new infrastructure sites. Return ONLY valid JSON matching this schema: {"suggestions":[{...}],"summary":"..."}. Suggestions must include id, lat, lng, priority (high|medium|low), hazards array, suggested_infrastructure, and 1-2 sentence reason.',
          },
          {
            role: 'user',
            content: JSON.stringify(contextPayload, null, 2),
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        this.logger.warn('OpenAI returned empty response for planning request');
        return this.buildFallbackSuggestions(request, candidates);
      }

      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        throw new Error('Invalid JSON schema from OpenAI');
      }

      return {
        suggestions: parsed.suggestions.slice(0, request.maxSuggestions),
        summary: parsed.summary || 'LLM summary unavailable.',
      };
    } catch (error) {
      this.logger.error(`OpenAI planning error: ${error.message}`);
      return this.buildFallbackSuggestions(request, candidates);
    }
  }

  private buildFallbackSuggestions(
    request: PlanningRequest,
    candidates: CandidateCell[],
  ): { suggestions: PlanningSuggestion[]; summary: string } {
    const selected = candidates.slice(0, request.maxSuggestions);
    const suggestions: PlanningSuggestion[] = selected.map((cell) => ({
      id: cell.id,
      lat: cell.lat,
      lng: cell.lng,
      priority: cell.priorityScore > 0.45 ? 'high' : cell.priorityScore > 0.25 ? 'medium' : 'low',
      hazards: request.hazards,
      suggested_infrastructure: request.infrastructureType,
      reason: cell.notes,
    }));

    const summary = suggestions.length
      ? `Identified ${suggestions.length} promising ${request.infrastructureType} sites focusing on ${request.hazards.join(', ')} risk.`
      : 'No high-priority cells identified inside the viewport. Try expanding the map or relaxing constraints.';

    return { suggestions, summary };
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const originLat = this.toRadians(lat1);
    const targetLat = this.toRadians(lat2);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(originLat) *
        Math.cos(targetLat) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }

  private average(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private clamp(value: number): number {
    if (Number.isNaN(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }
}
