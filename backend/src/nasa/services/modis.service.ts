import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

/**
 * NASA MODIS Service (Moderate Resolution Imaging Spectroradiometer)
 * Provides vegetation (NDVI), land surface temperature (LST), and aerosol optical depth (AOD)
 * Data available through AppEEARS API
 */
@Injectable()
export class ModisService {
  constructor(private readonly httpService: HttpService) {}

  /**
   * Get NDVI (Normalized Difference Vegetation Index) data
   * Higher values = more vegetation
   */
  async getNDVI(lat: number, lng: number) {
    // TODO: Implement AppEEARS API call for MODIS NDVI
    return this.estimateNDVI(lat, lng);
  }

  /**
   * Get Land Surface Temperature (LST)
   */
  async getLST(lat: number, lng: number) {
    // TODO: Implement AppEEARS API call for MODIS LST
    return this.estimateLST(lat, lng);
  }

  /**
   * Get Aerosol Optical Depth (AOD) - air quality indicator
   */
  async getAOD(lat: number, lng: number) {
    // TODO: Implement AppEEARS API call for MODIS AOD
    return this.estimateAOD(lat, lng);
  }

  /**
   * Estimate NDVI based on latitude (temp solution)
   */
  private estimateNDVI(lat: number, lng: number) {
    const absLat = Math.abs(lat);

    // Higher vegetation near equator, lower at poles
    let baseNDVI = 0.6;
    if (absLat < 10) {
      baseNDVI = 0.75; // Tropical rainforests
    } else if (absLat < 30) {
      baseNDVI = 0.55; // Subtropical
    } else if (absLat < 60) {
      baseNDVI = 0.45; // Temperate
    } else {
      baseNDVI = 0.2; // Polar/tundra
    }

    // Seasonal variation
    const month = new Date().getMonth();
    const seasonalFactor = Math.sin((month / 12) * Math.PI * 2) * 0.15;

    return {
      ndvi: Math.max(-1, Math.min(1, baseNDVI + seasonalFactor)),
      range: '-1 to 1',
      interpretation: this.interpretNDVI(baseNDVI),
      source: 'estimated',
      note: 'Replace with actual MODIS data from AppEEARS',
    };
  }

  /**
   * Estimate Land Surface Temperature
   */
  private estimateLST(lat: number, lng: number) {
    const absLat = Math.abs(lat);

    // Temperature decreases with latitude
    const baseTemp = 30 - (absLat / 90) * 25; // Celsius

    // Seasonal variation
    const month = new Date().getMonth();
    const hemisphere = lat >= 0 ? 1 : -1;
    const seasonalFactor = Math.sin(((month - 6) / 12) * Math.PI * 2) * 10 * hemisphere;

    return {
      lst: baseTemp + seasonalFactor,
      unit: 'Celsius',
      source: 'estimated',
      note: 'Replace with actual MODIS LST data',
    };
  }

  /**
   * Estimate AOD (Air Quality)
   */
  private estimateAOD(lat: number, lng: number) {
    // Urban/industrial areas tend to have higher AOD
    // This is a very simplified estimation
    let baseAOD = 0.15; // Background level

    // Add random variation (in real scenario, would be based on actual pollution data)
    const variation = Math.random() * 0.3;

    return {
      aod: baseAOD + variation,
      range: '0 to 5 (typically 0-1)',
      interpretation: this.interpretAOD(baseAOD + variation),
      source: 'estimated',
      note: 'Replace with actual MODIS MAIAC AOD data',
    };
  }

  private interpretNDVI(ndvi: number): string {
    if (ndvi < 0) return 'Water';
    if (ndvi < 0.2) return 'Barren/Desert';
    if (ndvi < 0.4) return 'Sparse Vegetation';
    if (ndvi < 0.6) return 'Moderate Vegetation';
    return 'Dense Vegetation';
  }

  private interpretAOD(aod: number): string {
    if (aod < 0.1) return 'Excellent Air Quality';
    if (aod < 0.3) return 'Good Air Quality';
    if (aod < 0.5) return 'Moderate Air Quality';
    if (aod < 1.0) return 'Poor Air Quality';
    return 'Very Poor Air Quality';
  }
}
