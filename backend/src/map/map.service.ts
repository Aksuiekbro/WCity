import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ScoringService } from '../data/scoring.service';

interface Bounds {
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
}

@Injectable()
export class MapService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private scoringService: ScoringService,
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
}
