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
  private readonly CACHE_TTL = 60 * 60 * 1000; // 60 minutes (increased to reduce API pressure)

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
      console.log(`🔍 SEDAC: Fetching population for (${lat}, ${lng}), username: ${username ? 'SET' : 'NOT SET'}`);

      if (!username) {
        console.warn('⚠️ GEONAMES_USERNAME not set, using estimation');
        return this.estimatePopulationDensity(lat, lng);
      }

      // Find nearby populated place
      const url = `${this.GEONAMES_BASE_URL}/findNearbyPlaceNameJSON`;
      const params = {
        lat: lat.toString(),
        lng: lng.toString(),
        username,
        radius: '300', // Search within 300km (max for free tier)
        maxRows: '1',
        cities: 'cities1000', // Only cities with 1000+ population
      };

      const response = await firstValueFrom(
        this.httpService.get(url, { params, timeout: 5000 }),
      );

      if (response.data?.geonames?.[0]) {
        const place = response.data.geonames[0];
        const result = this.calculateDensityFromPlace(place, lat, lng);
        console.log(`✅ GeoNames found: ${place.name}, pop: ${place.population}, density: ${result.populationDensity}`);

        // Cache the result
        this.populationCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
        });

        return result;
      } else {
        console.warn(`⚠️ GeoNames returned no results for (${lat}, ${lng})`);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.status?.message || error.message;

      // Detect rate limiting
      if (errorMsg?.includes('limit') || errorMsg?.includes('credits') || error.response?.status === 503) {
        console.warn('⚠️ GeoNames API RATE LIMIT EXCEEDED - Please wait before making more requests');
        console.warn('   Free tier: 10,000 requests/day, ~1000/hour. Consider upgrading or reducing requests.');
      } else {
        console.warn('❌ GeoNames API error, using estimation:', errorMsg);
      }
    }

    // Fallback to estimation
    console.log(`📍 Using estimation fallback for (${lat}, ${lng})`);
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

    // Estimate city area based on population (more accurate approximation)
    // Based on real-world city area data
    let cityArea = 50; // Default 50 km²
    if (population > 5000000) cityArea = 1500;      // Mega cities (e.g., Tokyo metro)
    else if (population > 2000000) cityArea = 800;  // Large cities
    else if (population > 1000000) cityArea = 600;  // Major cities (e.g., Almaty ~682 km²)
    else if (population > 500000) cityArea = 300;   // Medium-large cities
    else if (population > 100000) cityArea = 150;   // Medium cities
    else if (population > 50000) cityArea = 70;     // Small cities
    else cityArea = 30;                             // Towns

    // Base density (people per km²)
    const baseDensity = population / cityArea;

    // Apply distance decay function only if far from center
    // Within city limits (< 10km), use base density with minimal decay
    let decayFactor = 1.0;
    if (distance > 10) {
      // Beyond 10km, apply exponential decay
      decayFactor = Math.exp(-(distance - 10) / 15); // Decay over ~15km beyond city
    } else {
      // Within 10km, apply gentle linear reduction
      decayFactor = 1.0 - (distance * 0.02); // 2% reduction per km
    }

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
      { lat: -33.8688, lng: 151.2093, density: 2037 }, // Sydney
      { lat: 55.7558, lng: 37.6173, density: 4900 }, // Moscow
      { lat: 19.4326, lng: -99.1332, density: 6000 }, // Mexico City
      { lat: 1.3521, lng: 103.8198, density: 8358 }, // Singapore
      { lat: 30.0444, lng: 31.2357, density: 3500 }, // Cairo
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

    // Density decreases exponentially with distance
    // Use exponential decay instead of linear to get more realistic values
    // Decay constant: 1/200 means significant drop-off after ~200km
    const decayConstant = 1 / 200;
    const densityFactor = Math.exp(-minDistance * decayConstant);
    const estimatedDensity = closestCity.density * densityFactor;

    // Very remote areas (>1000km from any major city) should have random low density
    // If density drops below 20, use random value between 20-100
    let finalDensity = Math.round(estimatedDensity);
    if (finalDensity < 20) {
      finalDensity = Math.floor(Math.random() * (100 - 20 + 1)) + 20;
    }

    return {
      populationDensity: finalDensity,
      unit: 'people per sq km',
      source: 'estimated',
      note: `Estimated based on distance (${Math.round(minDistance)}km) from nearest reference city`,
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
