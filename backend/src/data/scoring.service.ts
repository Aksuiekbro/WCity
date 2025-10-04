import { Injectable } from '@nestjs/common';
import { NormalizationService } from './normalization.service';
import { PowerService } from '../nasa/services/power.service';
import { SedacService } from '../nasa/services/sedac.service';
import { GldasService } from '../nasa/services/gldas.service';
import { ModisService } from '../nasa/services/modis.service';

export interface LocationScores {
  location: {
    lat: number;
    lng: number;
  };
  scores: {
    airQuality: {
      score: number;
      aod: number;
      interpretation: string;
    };
    vegetation: {
      score: number;
      ndvi: number;
      interpretation: string;
    };
    temperature: {
      score: number;
      current: number;
      unit: string;
    };
    water: {
      score: number;
      soilMoisture: number;
      unit: string;
    };
    urbanization: {
      score: number;
      populationDensity: number;
      unit: string;
    };
  };
  overall: {
    score: number;
    grade: string;
    suitability: string;
  };
  timestamp: string;
}

/**
 * Scoring Service
 * Calculates city suitability scores based on NASA environmental data
 */
@Injectable()
export class ScoringService {
  constructor(
    private readonly normalization: NormalizationService,
    private readonly powerService: PowerService,
    private readonly sedacService: SedacService,
    private readonly gldasService: GldasService,
    private readonly modisService: ModisService,
  ) {}

  /**
   * Calculate comprehensive scores for a location
   */
  async calculateScores(lat: number, lng: number): Promise<LocationScores> {
    // Fetch data from all NASA services in parallel
    const [tempData, soilData, ndviData, aodData, popData] = await Promise.all([
      this.powerService.getTemperatureData(lat, lng),
      this.gldasService.getSoilMoisture(lat, lng),
      this.modisService.getNDVI(lat, lng),
      this.modisService.getAOD(lat, lng),
      this.sedacService.getPopulationDensity(lat, lng),
    ]);

    // Extract values
    const temperature = tempData?.current || 20;
    const soilMoisture = soilData?.soilMoisture || 0.3;
    const ndvi = ndviData?.ndvi || 0.5;
    const aod = aodData?.aod || 0.2;
    const populationDensity = popData?.populationDensity || 100;

    // Normalize to scores (0-1)
    const tempScore = this.normalization.normalizeTemperature(temperature);
    const waterScore = this.normalization.normalizeSoilMoisture(soilMoisture);
    const vegScore = this.normalization.normalizeNDVI(ndvi);
    const airScore = this.normalization.normalizeAOD(aod);
    const urbanScore = this.normalization.normalizePopulationDensity(
      populationDensity,
    );

    // Calculate overall score (weighted average)
    const weights = {
      airQuality: 0.25,
      vegetation: 0.2,
      temperature: 0.2,
      water: 0.2,
      urbanization: 0.15,
    };

    const overallScore = this.normalization.weightedAverage(
      [airScore, vegScore, tempScore, waterScore, urbanScore],
      Object.values(weights),
    );

    return {
      location: { lat, lng },
      scores: {
        airQuality: {
          score: this.toPercentage(airScore),
          aod: aod,
          interpretation: this.interpretAirQuality(airScore),
        },
        vegetation: {
          score: this.toPercentage(vegScore),
          ndvi: ndvi,
          interpretation: this.interpretVegetation(ndvi),
        },
        temperature: {
          score: this.toPercentage(tempScore),
          current: Math.round(temperature * 10) / 10,
          unit: '°C',
        },
        water: {
          score: this.toPercentage(waterScore),
          soilMoisture: Math.round(soilMoisture * 100) / 100,
          unit: 'volumetric',
        },
        urbanization: {
          score: this.toPercentage(urbanScore),
          populationDensity: Math.round(populationDensity),
          unit: 'people/km²',
        },
      },
      overall: {
        score: this.toPercentage(overallScore),
        grade: this.scoreToGrade(overallScore),
        suitability: this.interpretSuitability(overallScore),
      },
      timestamp: new Date().toISOString(),
    };
  }

  private toPercentage(score: number): number {
    return Math.round(score * 100);
  }

  private scoreToGrade(score: number): string {
    if (score >= 0.9) return 'A+';
    if (score >= 0.8) return 'A';
    if (score >= 0.7) return 'B+';
    if (score >= 0.6) return 'B';
    if (score >= 0.5) return 'C+';
    if (score >= 0.4) return 'C';
    if (score >= 0.3) return 'D';
    return 'F';
  }

  private interpretSuitability(score: number): string {
    if (score >= 0.8) return 'Excellent living conditions';
    if (score >= 0.6) return 'Good living conditions';
    if (score >= 0.4) return 'Moderate living conditions';
    if (score >= 0.2) return 'Challenging living conditions';
    return 'Difficult living conditions';
  }

  private interpretAirQuality(score: number): string {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Moderate';
    if (score >= 0.2) return 'Poor';
    return 'Very Poor';
  }

  private interpretVegetation(ndvi: number): string {
    if (ndvi < 0) return 'Water';
    if (ndvi < 0.2) return 'Barren/Urban';
    if (ndvi < 0.4) return 'Sparse Vegetation';
    if (ndvi < 0.6) return 'Moderate Vegetation';
    return 'Dense Vegetation';
  }
}
