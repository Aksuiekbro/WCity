import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ScoringService } from '../data/scoring.service';
import { InfrastructureService } from '../data/infrastructure.service';
import { OverpassService } from '../data/overpass.service';
import {
  PlanningService,
  PlanningRequest,
  PlanningResponse,
} from './planning.service';
import { createHash } from 'crypto';

export interface Bounds {
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
}

interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface InfrastructurePOI {
  id: string;
  lat: number;
  lng: number;
  name: string;
  type: string;
}

@Injectable()
export class MapService {
  private readonly GEONAMES_BASE_URL = 'http://api.geonames.org';

  constructor(
    private scoringService: ScoringService,
    private infrastructureService: InfrastructureService,
    private overpassService: OverpassService,
    private planningService: PlanningService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getLocationScore(lat: number, lng: number) {
    const scores = await this.scoringService.calculateScores(lat, lng);
    return scores;
  }

  async getLayerData(layerType: string, bounds: Bounds) {
    // TODO: Implement layer data fetching based on layerType
    const layerData = {
      type: layerType,
      bounds,
      data: [],
    };

    return layerData;
  }

  async getTimeSeries(lat: number, lng: number, metric: string) {
    // TODO: Implement time series data fetching
    const timeSeriesData = {
      metric,
      location: { lat, lng },
      data: [],
    };

    return timeSeriesData;
  }

  async getRecommendations(lat: number, lng: number) {
    // Get location scores first
    const scores = await this.getLocationScore(lat, lng);

    // Generate recommendations based on scores
    const recommendations = await this.infrastructureService.generateRecommendations(scores as any);

    return recommendations;
  }

  async getPlanningRecommendations(
    payload: PlanningRequest,
  ): Promise<PlanningResponse> {
    const hash = createHash('md5')
      .update(JSON.stringify(payload))
      .digest('hex');
    const response = await this.planningService.suggestInfrastructureSites(payload);
    return response;
  }

  /**
   * Get cities within a viewport bounding box for population heatmap
   * Uses GeoNames cities API with bounding box search
   */
  async getCitiesInViewport(bounds: ViewportBounds) {
    try {
      const username = this.configService.get<string>('GEONAMES_USERNAME');

      if (!username) {
        console.warn('GEONAMES_USERNAME not set for cities endpoint');
        return { cities: [], source: 'unavailable' };
      }

      // GeoNames cities API with bounding box
      const url = `${this.GEONAMES_BASE_URL}/citiesJSON`;
      const params = {
        north: bounds.north.toString(),
        south: bounds.south.toString(),
        east: bounds.east.toString(),
        west: bounds.west.toString(),
        maxRows: '100', // Limit to 100 cities for performance
        username,
      };

      const response = await firstValueFrom(
        this.httpService.get(url, { params, timeout: 5000 }),
      );

      if (response.data?.geonames) {
        const cities = response.data.geonames.map((city: any) => ({
          lat: parseFloat(city.lat),
          lng: parseFloat(city.lng),
          name: city.name,
          population: city.population || 0,
          countryCode: city.countryCode,
        }));

        const result = { cities, source: 'GeoNames API', count: cities.length };
        return result;
      }

      return { cities: [], source: 'GeoNames API', count: 0 };
    } catch (error) {
      console.error('Error fetching cities from GeoNames:', error.message);
      return { cities: [], source: 'error', error: error.message };
    }
  }

  /**
   * Get hospitals or schools within a viewport bounding box
   * Uses Overpass API to fetch OpenStreetMap POI data
   */
  async getInfrastructure(type: string, bounds: ViewportBounds) {
    try {
      let pois: InfrastructurePOI[] = [];

      if (type === 'hospitals') {
        pois = await this.overpassService.getHospitalsInViewport(bounds);
      } else if (type === 'schools') {
        pois = await this.overpassService.getSchoolsInViewport(bounds);
      } else if (type === 'fire_stations') {
        pois = await this.overpassService.getFireStationsInViewport(bounds);
      } else if (type === 'police') {
        pois = await this.overpassService.getPoliceInViewport(bounds);
      } else if (type === 'kindergartens') {
        pois = await this.overpassService.getKindergartensInViewport(bounds);
      } else if (type === 'universities') {
        pois = await this.overpassService.getUniversitiesInViewport(bounds);
      } else if (type === 'power_plants') {
        pois = await this.overpassService.getPowerPlantsInViewport(bounds);
      } else if (type === 'orphanages') {
        pois = await this.overpassService.getOrphanagesInViewport(bounds);
      } else if (type === 'nursing_homes') {
        pois = await this.overpassService.getNursingHomesInViewport(bounds);
      }

      const result = {
        pois: pois.map(p => ({ ...p, type })),
        type,
        source: 'OpenStreetMap Overpass API',
        count: pois.length
      };
      return result;
    } catch (error) {
      console.error(`Error fetching ${type} from Overpass:`, error.message);
      return { pois: [], type, source: 'error', error: error.message };
    }
  }
}
