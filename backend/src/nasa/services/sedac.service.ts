import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * NASA SEDAC (Socioeconomic Data and Applications Center) Service
 * Provides population and demographic data using GeoNames API
 * GeoNames: Free API for geographic data including population
 */
@Injectable()
export class SedacService {
  private readonly GEONAMES_BASE_URL = 'http://api.geonames.org';
  private readonly populationCache = new Map<string, any>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get population density for a location using GeoNames API
   * Finds nearest populated place and calculates density based on distance
   */
  async getPopulationDensity(lat: number, lng: number) {
    const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;

    // Check cache
    const cached = this.populationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const username = this.configService.get<string>('GEONAMES_USERNAME');

      if (!username) {
        console.warn('GEONAMES_USERNAME not set, using estimation');
        return this.estimatePopulationDensity(lat, lng);
      }

      // Find nearby populated place
      const url = `${this.GEONAMES_BASE_URL}/findNearbyPlaceNameJSON`;
      const params = {
        lat: lat.toString(),
        lng: lng.toString(),
        username,
        radius: '50', // Search within 50km
        maxRows: '1',
        cities: 'cities1000', // Only cities with 1000+ population
      };

      const response = await firstValueFrom(
        this.httpService.get(url, { params, timeout: 5000 }),
      );

      if (response.data?.geonames?.[0]) {
        const place = response.data.geonames[0];
        const result = this.calculateDensityFromPlace(place, lat, lng);

        // Cache the result
        this.populationCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
        });

        return result;
      }
    } catch (error) {
      console.warn('GeoNames API error, using estimation:', error.message);
    }

    // Fallback to estimation
    return this.estimatePopulationDensity(lat, lng);
  }

  /**
   * Calculate population density from GeoNames place data
   */
  private calculateDensityFromPlace(place: any, queryLat: number, queryLng: number) {
    const population = place.population || 0;
    const distance = parseFloat(place.distance) || 0; // Distance in km
    const placeName = place.name || 'Unknown';
    const countryCode = place.countryCode || '';

    // Estimate city area based on population (rough approximation)
    // Small city: 10-50 km², Medium: 50-200 km², Large: 200-1000 km²
    let cityArea = 50; // Default 50 km²
    if (population > 1000000) cityArea = 500;
    else if (population > 500000) cityArea = 200;
    else if (population > 100000) cityArea = 100;
    else if (population > 50000) cityArea = 50;
    else cityArea = 20;

    // Base density (people per km²)
    const baseDensity = population / cityArea;

    // Apply distance decay function
    // Density decreases exponentially with distance from city center
    const decayFactor = Math.exp(-distance / 10); // Decay over ~10km radius
    const estimatedDensity = Math.round(baseDensity * decayFactor);

    return {
      populationDensity: Math.max(10, estimatedDensity), // Minimum 10 people/km²
      unit: 'people per sq km',
      source: 'GeoNames API',
      nearestCity: placeName,
      cityPopulation: population,
      distanceToCity: distance,
      countryCode,
      note: `Based on ${placeName} (${distance.toFixed(1)}km away, pop: ${population.toLocaleString()})`,
    };
  }

  /**
   * Estimate population based on coordinates (fallback method)
   */
  private estimatePopulationDensity(lat: number, lng: number): any {
    // Simple estimation: higher density near major city coordinates
    const majorCities = [
      { lat: 40.7128, lng: -74.006, density: 10752 }, // NYC
      { lat: 34.0522, lng: -118.2437, density: 3276 }, // LA
      { lat: 41.8781, lng: -87.6298, density: 4600 }, // Chicago
      { lat: 51.5074, lng: -0.1278, density: 5700 }, // London
      { lat: 35.6762, lng: 139.6503, density: 6158 }, // Tokyo
    ];

    let closestCity = majorCities[0];
    let minDistance = this.calculateDistance(lat, lng, closestCity.lat, closestCity.lng);

    for (const city of majorCities) {
      const distance = this.calculateDistance(lat, lng, city.lat, city.lng);
      if (distance < minDistance) {
        minDistance = distance;
        closestCity = city;
      }
    }

    // Density decreases with distance
    const densityFactor = Math.max(0, 1 - minDistance / 1000);
    const estimatedDensity = closestCity.density * densityFactor;

    return {
      populationDensity: Math.round(estimatedDensity),
      unit: 'people per sq km',
      source: 'estimated',
      note: 'Replace with actual SEDAC GPW data',
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
