import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AppEEARSService } from './appeears.service';

/**
 * NASA MODIS Service (Moderate Resolution Imaging Spectroradiometer)
 * Provides vegetation (NDVI), land surface temperature (LST), and aerosol optical depth (AOD)
 * Data available through AppEEARS API
 */
@Injectable()
export class ModisService {
  constructor(
    private readonly httpService: HttpService,
    private readonly appeears: AppEEARSService,
  ) {}

  /**
   * Get NDVI (Normalized Difference Vegetation Index) data
   * Uses enhanced climate-based estimation model
   */
  async getNDVI(lat: number, lng: number) {
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
   * Enhanced NDVI estimation based on climate zones and geography
   */
  private estimateNDVI(lat: number, lng: number) {
    const absLat = Math.abs(lat);
    const month = new Date().getMonth();
    const hemisphere = lat >= 0 ? 'north' : 'south';

    // Determine base NDVI from climate zone
    let baseNDVI = 0.5;
    let seasonalAmplitude = 0.15;

    // Tropical zone (0-23.5°)
    if (absLat < 23.5) {
      // Rainforest regions (high rainfall)
      if ((lng > -80 && lng < -30) || // Amazon
          (lng > 90 && lng < 150) ||   // SE Asia
          (lng > 10 && lng < 40)) {    // Central Africa
        baseNDVI = 0.75;
        seasonalAmplitude = 0.1; // Less seasonal variation
      }
      // Dry tropical regions
      else if ((lng > -120 && lng < -90) || // Central America (dry)
               (lng > 40 && lng < 60) ||     // Middle East
               (lng > -20 && lng < 10)) {    // Sahel/Sahara
        baseNDVI = 0.25;
        seasonalAmplitude = 0.2;
      }
      else {
        baseNDVI = 0.6; // General tropical
        seasonalAmplitude = 0.15;
      }
    }
    // Subtropical (23.5-35°)
    else if (absLat < 35) {
      // Desert regions
      if ((lng > -120 && lng < -100) || // Southwestern US/Mexico
          (lng > -20 && lng < 60) ||     // Sahara to Arabian
          (lng > 110 && lng < 150)) {    // Australian deserts
        baseNDVI = 0.15;
        seasonalAmplitude = 0.1;
      }
      // Mediterranean/humid subtropical
      else {
        baseNDVI = 0.5;
        seasonalAmplitude = 0.25;
      }
    }
    // Temperate (35-60°)
    else if (absLat < 60) {
      // Major population centers (mixed urban/vegetation)
      baseNDVI = 0.45;
      seasonalAmplitude = 0.3; // High seasonal variation
    }
    // Boreal/Polar (60-90°)
    else {
      baseNDVI = 0.2;
      seasonalAmplitude = 0.15;
    }

    // Calculate seasonal variation
    // North hemisphere: peak in July (month 6), South: peak in January (month 0)
    const monthOffset = hemisphere === 'north' ? month - 6 : month;
    const seasonalFactor = Math.cos((monthOffset / 12) * Math.PI * 2) * seasonalAmplitude;

    const finalNDVI = Math.max(-0.1, Math.min(0.95, baseNDVI + seasonalFactor));

    return {
      ndvi: Number(finalNDVI.toFixed(2)),
      range: '-1 to 1',
      interpretation: this.interpretNDVI(finalNDVI),
      source: 'climate-based model',
      note: 'Enhanced estimation using Köppen climate zones and geography',
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
