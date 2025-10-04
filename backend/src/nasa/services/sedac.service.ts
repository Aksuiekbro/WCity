import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

/**
 * NASA SEDAC (Socioeconomic Data and Applications Center) Service
 * Provides population and demographic data
 * Note: SEDAC requires authentication for most datasets
 */
@Injectable()
export class SedacService {
  constructor(private readonly httpService: HttpService) {}

  /**
   * Get estimated population density for a location
   * Note: This is a simplified mock implementation
   * Real implementation would use SEDAC GPW (Gridded Population of the World)
   */
  async getPopulationDensity(lat: number, lng: number) {
    // TODO: Implement actual SEDAC API call
    // For now, returning estimated data based on location
    return this.estimatePopulationDensity(lat, lng);
  }

  /**
   * Estimate population based on coordinates (temporary solution)
   * In production, this would query the actual SEDAC GPW dataset
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
