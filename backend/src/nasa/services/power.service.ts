import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * NASA POWER API Service
 * Provides access to solar and meteorological data
 * Documentation: https://power.larc.nasa.gov/docs/
 */
@Injectable()
export class PowerService {
  private readonly BASE_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';

  constructor(private readonly httpService: HttpService) {}

  /**
   * Get temperature data for a location
   * @param lat Latitude
   * @param lng Longitude
   * @param startDate Start date (YYYYMMDD)
   * @param endDate End date (YYYYMMDD)
   */
  async getTemperatureData(
    lat: number,
    lng: number,
    startDate?: string,
    endDate?: string,
  ) {
    const params = {
      parameters: 'T2M,T2M_MAX,T2M_MIN', // Temperature at 2m
      community: 'RE',
      longitude: lng,
      latitude: lat,
      start: startDate || this.getDefaultStartDate(),
      end: endDate || this.getCurrentDate(),
      format: 'JSON',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get(this.BASE_URL, { params }),
      );
      return this.parseTemperatureData(response.data);
    } catch (error) {
      console.error('Error fetching POWER temperature data:', error.message);
      return null;
    }
  }

  /**
   * Get solar radiation data
   */
  async getSolarData(lat: number, lng: number) {
    const params = {
      parameters: 'ALLSKY_SFC_SW_DWN',
      community: 'RE',
      longitude: lng,
      latitude: lat,
      start: this.getDefaultStartDate(),
      end: this.getCurrentDate(),
      format: 'JSON',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get(this.BASE_URL, { params }),
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching POWER solar data:', error.message);
      return null;
    }
  }

  private parseTemperatureData(data: any) {
    const properties = data?.properties?.parameter;
    if (!properties) return null;

    const temps = properties.T2M || {};
    const values = Object.values(temps).filter(
      (v) => typeof v === 'number',
    ) as number[];

    return {
      current: values[values.length - 1] || null,
      average: values.reduce((a, b) => a + b, 0) / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
      timeSeries: temps,
    };
  }

  private getCurrentDate(): string {
    // NASA POWER has significant data processing delay
    // Use date from exactly 1 year ago
    const now = new Date();
    now.setFullYear(now.getFullYear() - 1);
    return now.toISOString().slice(0, 10).replace(/-/g, '');
  }

  private getDefaultStartDate(): string {
    // Get data from 1 month before the end date (13 months ago total)
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() - 1);
    endDate.setMonth(endDate.getMonth() - 1);
    return endDate.toISOString().slice(0, 10).replace(/-/g, '');
  }
}
