import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ScoringService } from '../data/scoring.service';
import { InfrastructureService } from '../data/infrastructure.service';
import { OverpassService } from '../data/overpass.service';

interface Bounds {
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

@Injectable()
export class MapService {
  private readonly GEONAMES_BASE_URL = 'http://api.geonames.org';

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private scoringService: ScoringService,
    private infrastructureService: InfrastructureService,
    private overpassService: OverpassService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getLocationScore(lat: number, lng: number) {
    const cacheKey = `score_${lat}_${lng}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const scores = await this.scoringService.calculateScores(lat, lng);
    await this.cacheManager.set(cacheKey, scores);

    return scores;
  }

  async getLayerData(layerType: string, bounds: Bounds) {
    const cacheKey = `layer_${layerType}_${JSON.stringify(bounds)}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    // TODO: Implement layer data fetching based on layerType
    const layerData = {
      type: layerType,
      bounds,
      data: [],
    };

    await this.cacheManager.set(cacheKey, layerData);
    return layerData;
  }

  async getTimeSeries(lat: number, lng: number, metric: string) {
    const cacheKey = `timeseries_${lat}_${lng}_${metric}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    // TODO: Implement time series data fetching
    const timeSeriesData = {
      metric,
      location: { lat, lng },
      data: [],
    };

    await this.cacheManager.set(cacheKey, timeSeriesData);
    return timeSeriesData;
  }

  async getRecommendations(lat: number, lng: number) {
    const cacheKey = `recommendations_${lat}_${lng}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    // Get location scores first
    const scores = await this.getLocationScore(lat, lng);

    // Generate recommendations based on scores
    const recommendations = await this.infrastructureService.generateRecommendations(scores as any);

    await this.cacheManager.set(cacheKey, recommendations);
    return recommendations;
  }

  /**
   * Get cities within a viewport bounding box for population heatmap
   * Uses GeoNames cities API with bounding box search
   */
  async getCitiesInViewport(bounds: ViewportBounds) {
    const cacheKey = `cities_${bounds.north}_${bounds.south}_${bounds.east}_${bounds.west}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

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

        // Cache for 30 minutes
        await this.cacheManager.set(cacheKey, result, 30 * 60 * 1000);

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
    const cacheKey = `infrastructure_${type}_${bounds.north}_${bounds.south}_${bounds.east}_${bounds.west}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      let pois = [];

      if (type === 'hospitals') {
        pois = await this.overpassService.getHospitalsInViewport(bounds);
      } else if (type === 'schools') {
        pois = await this.overpassService.getSchoolsInViewport(bounds);
      }

      const result = {
        pois,
        type,
        source: 'OpenStreetMap Overpass API',
        count: pois.length
      };

      // Cache for 15 minutes (consistent with other endpoints)
      await this.cacheManager.set(cacheKey, result, 15 * 60 * 1000);

      return result;
    } catch (error) {
      console.error(`Error fetching ${type} from Overpass:`, error.message);
      return { pois: [], type, source: 'error', error: error.message };
    }
  }
}
