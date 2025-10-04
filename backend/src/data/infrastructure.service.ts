import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { LocationScores } from './scoring.service';

/**
 * Infrastructure Recommendation Service
 * Uses OpenAI ChatGPT to analyze environmental data and recommend infrastructure improvements
 */
@Injectable()
export class InfrastructureService {
  private openai: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      console.warn('OPENAI_API_KEY not set - infrastructure recommendations will use fallback mode');
    }
  }

  /**
   * Generate infrastructure recommendations based on location scores
   */
  async generateRecommendations(scores: LocationScores): Promise<{
    recommendations: string[];
    priority: 'high' | 'medium' | 'low';
    summary: string;
  }> {
    if (!this.openai) {
      return this.getFallbackRecommendations(scores);
    }

    try {
      const prompt = this.buildPrompt(scores);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert urban planner and environmental scientist. Analyze environmental data and provide specific, actionable infrastructure recommendations for cities. Focus on practical solutions based on the data provided.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      const response = completion.choices[0]?.message?.content || '';
      return this.parseRecommendations(response, scores);
    } catch (error) {
      console.error('OpenAI API error:', error.message);
      return this.getFallbackRecommendations(scores);
    }
  }

  /**
   * Build the prompt for ChatGPT with all environmental data
   */
  private buildPrompt(scores: LocationScores): string {
    const { location, scores: metrics, overall } = scores;

    return `Analyze the following environmental data for a city location at coordinates (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}) and provide infrastructure recommendations:

**Overall City Suitability:**
- Score: ${overall.score}/100 (Grade: ${overall.grade})
- Assessment: ${overall.suitability}

**Environmental Metrics:**

1. **Air Quality:** ${metrics.airQuality.score}/100 (${metrics.airQuality.interpretation})
   - Aerosol Optical Depth (AOD): ${metrics.airQuality.aod.toFixed(3)}
   - Context: AOD measures atmospheric pollution. Higher values indicate more air pollution.

2. **Vegetation Coverage:** ${metrics.vegetation.score}/100 (${metrics.vegetation.interpretation})
   - NDVI: ${metrics.vegetation.ndvi.toFixed(2)}
   - Context: NDVI measures plant health. Range: -1 (water) to +1 (dense vegetation).

3. **Temperature:** ${metrics.temperature.score}/100
   - Current: ${metrics.temperature.current}°C
   - Context: Optimal temperature for livability is around 20°C.

4. **Water Availability:** ${metrics.water.score}/100
   - Soil Moisture: ${metrics.water.soilMoisture} ${metrics.water.unit}
   - Context: Optimal soil moisture is 0.3-0.6 (not too dry, not waterlogged).

5. **Urbanization:** ${metrics.urbanization.score}/100
   - Population Density: ${metrics.urbanization.populationDensity} ${metrics.urbanization.unit}
   - Context: Indicates level of urban development.

**Instructions:**
Based on this data, provide:
1. A brief summary (1-2 sentences) of the main environmental challenges
2. 4-6 specific infrastructure recommendations prioritized by importance
3. Focus on areas with low scores that need improvement

Format your response as:
SUMMARY: [your summary]
PRIORITY: [high/medium/low based on overall score]
RECOMMENDATIONS:
- [Recommendation 1]
- [Recommendation 2]
- [etc.]`;
  }

  /**
   * Parse ChatGPT response into structured data
   */
  private parseRecommendations(response: string, scores: LocationScores): {
    recommendations: string[];
    priority: 'high' | 'medium' | 'low';
    summary: string;
  } {
    const lines = response.split('\n').filter(line => line.trim());

    let summary = '';
    let priority: 'high' | 'medium' | 'low' = 'medium';
    const recommendations: string[] = [];

    for (const line of lines) {
      if (line.startsWith('SUMMARY:')) {
        summary = line.replace('SUMMARY:', '').trim();
      } else if (line.startsWith('PRIORITY:')) {
        const p = line.replace('PRIORITY:', '').trim().toLowerCase();
        if (p === 'high' || p === 'medium' || p === 'low') {
          priority = p;
        }
      } else if (line.startsWith('RECOMMENDATIONS:')) {
        continue;
      } else if (line.trim().startsWith('-') || line.trim().match(/^\d+\./)) {
        const rec = line.trim().replace(/^[-\d+.]\s*/, '').trim();
        if (rec) recommendations.push(rec);
      }
    }

    // Fallback if parsing failed
    if (!summary) {
      summary = this.generateSummary(scores);
    }
    if (recommendations.length === 0) {
      recommendations.push(...response.split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace('-', '').trim()));
    }

    return { summary, priority, recommendations: recommendations.slice(0, 6) };
  }

  /**
   * Generate summary based on scores
   */
  private generateSummary(scores: LocationScores): string {
    const weakest = this.findWeakestMetrics(scores);
    if (weakest.length === 0) {
      return 'This location shows good environmental conditions across all metrics.';
    }
    return `Primary concerns include ${weakest.join(' and ')}, requiring targeted infrastructure improvements.`;
  }

  /**
   * Find metrics with scores below 60
   */
  private findWeakestMetrics(scores: LocationScores): string[] {
    const weak: string[] = [];
    if (scores.scores.airQuality.score < 60) weak.push('air quality');
    if (scores.scores.vegetation.score < 60) weak.push('vegetation coverage');
    if (scores.scores.temperature.score < 60) weak.push('temperature regulation');
    if (scores.scores.water.score < 60) weak.push('water management');
    return weak;
  }

  /**
   * Fallback recommendations when OpenAI API is not available
   */
  private getFallbackRecommendations(scores: LocationScores): {
    recommendations: string[];
    priority: 'high' | 'medium' | 'low';
    summary: string;
  } {
    const recommendations: string[] = [];
    const { scores: metrics, overall } = scores;

    // Air Quality recommendations
    if (metrics.airQuality.score < 60) {
      recommendations.push('Implement clean air zones and increase public transportation to reduce vehicle emissions');
      recommendations.push('Plant more trees and create green corridors to filter air pollutants');
    }

    // Vegetation recommendations
    if (metrics.vegetation.score < 60) {
      recommendations.push('Develop urban parks and green spaces to increase vegetation coverage');
      recommendations.push('Implement green roof and vertical garden programs for buildings');
    }

    // Temperature recommendations
    if (metrics.temperature.score < 60) {
      if (metrics.temperature.current > 25) {
        recommendations.push('Create urban cooling strategies: shade structures, water features, and reflective surfaces');
      } else {
        recommendations.push('Improve building insulation and energy-efficient heating systems');
      }
    }

    // Water recommendations
    if (metrics.water.score < 60) {
      if (metrics.water.soilMoisture < 0.3) {
        recommendations.push('Develop rainwater harvesting systems and improve irrigation infrastructure');
      } else {
        recommendations.push('Improve drainage systems and implement sustainable urban drainage solutions');
      }
    }

    // Urbanization recommendations
    if (metrics.urbanization.score < 40) {
      recommendations.push('Invest in basic infrastructure: roads, utilities, and public services');
    } else if (metrics.urbanization.score > 90) {
      recommendations.push('Focus on smart city technologies and efficient space utilization');
    }

    // Add general recommendations if specific ones are few
    if (recommendations.length < 3) {
      recommendations.push('Maintain current environmental standards with regular monitoring');
      recommendations.push('Plan for sustainable growth with green infrastructure integration');
    }

    const priority = overall.score < 50 ? 'high' : overall.score < 70 ? 'medium' : 'low';
    const summary = this.generateSummary(scores);

    return {
      recommendations: recommendations.slice(0, 6),
      priority,
      summary: summary || 'Infrastructure recommendations based on environmental analysis.',
    };
  }
}
