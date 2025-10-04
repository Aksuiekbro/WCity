import { Injectable } from '@nestjs/common';

/**
 * Normalization Service
 * Handles z-score normalization and scaling of environmental data
 */
@Injectable()
export class NormalizationService {
  /**
   * Z-score normalization (standardization)
   * Returns value scaled to mean=0, std=1
   */
  zScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  /**
   * Min-Max normalization (0-1 scale)
   */
  minMaxNormalize(value: number, min: number, max: number): number {
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  }

  /**
   * Normalize to 0-100 scale (percentage)
   */
  percentageScale(value: number, min: number, max: number): number {
    return this.minMaxNormalize(value, min, max) * 100;
  }

  /**
   * Normalize NDVI to 0-1 scale (from -1 to 1)
   */
  normalizeNDVI(ndvi: number): number {
    return (ndvi + 1) / 2; // Convert -1..1 to 0..1
  }

  /**
   * Normalize temperature to a suitability score (0-1)
   * Optimal range: 15-25°C
   */
  normalizeTemperature(tempCelsius: number): number {
    const optimal = 20; // 20°C is ideal
    const range = 15; // ±15°C tolerance

    // Distance from optimal
    const distance = Math.abs(tempCelsius - optimal);

    // Score decreases with distance from optimal
    const score = Math.max(0, 1 - distance / range);

    return score;
  }

  /**
   * Normalize AOD (Aerosol Optical Depth) to air quality score (0-1)
   * Lower AOD = better air quality = higher score
   */
  normalizeAOD(aod: number): number {
    // AOD typically ranges from 0 to 1 (rarely higher)
    // 0 = excellent, 1 = very poor
    // Invert and normalize
    return Math.max(0, Math.min(1, 1 - aod));
  }

  /**
   * Normalize soil moisture to water availability score (0-1)
   */
  normalizeSoilMoisture(moisture: number): number {
    // Moisture is already 0-1 in GLDAS
    // Optimal range: 0.3-0.6 (not too dry, not waterlogged)
    if (moisture < 0.1) return 0.2; // Too dry
    if (moisture < 0.3) return 0.5 + moisture; // Getting better
    if (moisture <= 0.6) return 1.0; // Optimal
    if (moisture < 0.8) return 0.8; // A bit too wet
    return 0.5; // Waterlogged
  }

  /**
   * Normalize population density to urbanization score
   * Uses logarithmic scale since population varies greatly
   */
  normalizePopulationDensity(density: number): number {
    if (density <= 0) return 0;

    // Logarithmic normalization
    // Typical ranges: rural ~50, suburban ~1000, urban ~5000, megacity ~10000+ per sq km
    const logDensity = Math.log10(density + 1);
    const logMax = Math.log10(10001); // ~10,000 as max reference

    return Math.min(1, logDensity / logMax);
  }

  /**
   * Apply inverse normalization (for metrics where lower is better)
   */
  invert(normalizedValue: number): number {
    return 1 - normalizedValue;
  }

  /**
   * Weighted average of multiple normalized scores
   */
  weightedAverage(scores: number[], weights: number[]): number {
    if (scores.length !== weights.length) {
      throw new Error('Scores and weights arrays must have same length');
    }

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = scores.reduce(
      (sum, score, i) => sum + score * weights[i],
      0,
    );

    return weightedSum / totalWeight;
  }

  /**
   * Batch normalize an array of values
   */
  normalizeArray(values: number[]): number[] {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    return values.map((val) => this.zScore(val, mean, stdDev));
  }
}
