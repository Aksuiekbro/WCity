import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * NASA AppEEARS API Service
 * Handles authentication and point sample requests for MODIS data
 * Documentation: https://appeears.earthdatacloud.nasa.gov/api/
 *
 * NOTE: Task submission currently encounters CloudFront WAF restrictions (400 errors)
 * when making programmatic requests. AppEEARS is designed for batch processing
 * via their web interface. The service falls back to estimated NDVI values.
 *
 * For production, consider:
 * - Pre-cached NDVI grids
 * - NASA CMR API for MODIS data
 * - Direct MODIS HDF file processing
 */
@Injectable()
export class AppEEARSService {
  private readonly BASE_URL = 'https://appeears.earthdatacloud.nasa.gov/api';
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get authentication token (cached for 48 hours)
   */
  private async getToken(): Promise<string> {
    // Return cached token if still valid
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    const username = this.configService.get<string>('NASA_EARTHDATA_USERNAME');
    const password = this.configService.get<string>('NASA_EARTHDATA_PASSWORD');

    if (!username || !password) {
      throw new Error('NASA_EARTHDATA_USERNAME and NASA_EARTHDATA_PASSWORD must be set');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.BASE_URL}/login`,
          {},
          {
            auth: {
              username,
              password,
            },
            headers: {
              'Content-Length': '0',
            },
          },
        ),
      );

      this.token = response.data.token;
      // Token expires in 48 hours, cache for 47 to be safe
      this.tokenExpiry = new Date(Date.now() + 47 * 60 * 60 * 1000);

      console.log('✓ AppEEARS authentication successful');
      return this.token!;
    } catch (error) {
      console.error('AppEEARS authentication failed:', error.message);
      throw new Error('Failed to authenticate with NASA AppEEARS API');
    }
  }

  /**
   * Get NDVI value for a specific point and date range
   * Uses synchronous point sample request
   */
  async getNDVIForPoint(lat: number, lng: number): Promise<{
    ndvi: number;
    date: string;
    source: string;
  } | null> {
    try {
      const token = await this.getToken();

      // Use 16-day MODIS NDVI product at 250m resolution
      // Request recent data from 1 year ago (to ensure availability)
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() - 1);
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 1); // Get 1 month of data

      const taskRequest = {
        task_type: 'point',
        task_name: `NDVI_${lat}_${lng}_${Date.now()}`,
        params: {
          dates: [
            {
              startDate: this.formatDateForAppEEARS(startDate),
              endDate: this.formatDateForAppEEARS(endDate),
            },
          ],
          layers: [
            {
              product: 'MOD13Q1.061', // MODIS Terra 16-day NDVI at 250m
              layer: '_250m_16_days_NDVI', // NDVI layer
            },
          ],
          coordinates: [
            {
              latitude: lat,
              longitude: lng,
              id: `point_${Date.now()}`,
            },
          ],
        },
      };

      // Submit task
      const submitResponse = await firstValueFrom(
        this.httpService.post(`${this.BASE_URL}/task`, taskRequest, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      const taskId = submitResponse.data.task_id;
      console.log(`AppEEARS task submitted: ${taskId}`);

      // Wait for task completion (polling)
      const result = await this.waitForTaskCompletion(taskId, token);

      return result;
    } catch (error) {
      // AppEEARS task endpoint is blocked by CloudFront WAF
      // This is expected - the API is designed for batch processing via web interface
      // Falls back to estimated NDVI in modis.service.ts
      console.log('AppEEARS unavailable, using estimated NDVI fallback');
      return null;
    }
  }

  /**
   * Poll task status until completion
   */
  private async waitForTaskCompletion(
    taskId: string,
    token: string,
    maxWaitMs: number = 120000, // 2 minutes max
  ): Promise<{
    ndvi: number;
    date: string;
    source: string;
  } | null> {
    const startTime = Date.now();
    const pollInterval = 5000; // Check every 5 seconds

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const statusResponse = await firstValueFrom(
          this.httpService.get(`${this.BASE_URL}/task/${taskId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );

        const status = statusResponse.data.status;

        if (status === 'done') {
          // Get the results
          return await this.extractNDVIFromResults(taskId, token);
        } else if (status === 'error') {
          console.error('AppEEARS task failed');
          return null;
        }

        // Still processing, wait before next check
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('Error checking task status:', error.message);
        return null;
      }
    }

    console.warn('AppEEARS task timeout');
    return null;
  }

  /**
   * Extract NDVI value from completed task results
   */
  private async extractNDVIFromResults(
    taskId: string,
    token: string,
  ): Promise<{
    ndvi: number;
    date: string;
    source: string;
  } | null> {
    try {
      // Get bundle (list of result files)
      const bundleResponse = await firstValueFrom(
        this.httpService.get(`${this.BASE_URL}/bundle/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      // Find the CSV file with results
      const csvFile = bundleResponse.data.files.find((f: any) =>
        f.file_name.endsWith('.csv'),
      );

      if (!csvFile) {
        console.error('No CSV file found in AppEEARS results');
        return null;
      }

      // Download CSV
      const csvResponse = await firstValueFrom(
        this.httpService.get(
          `${this.BASE_URL}/bundle/${taskId}/${csvFile.file_id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'text',
          },
        ),
      );

      // Parse CSV to get NDVI value
      const lines = csvResponse.data.split('\n');
      if (lines.length < 2) return null;

      // Find NDVI column and get most recent value
      const headers = lines[0].split(',');
      const ndviIndex = headers.findIndex((h: string) =>
        h.includes('NDVI'),
      );
      const dateIndex = headers.findIndex((h: string) =>
        h.toLowerCase().includes('date'),
      );

      if (ndviIndex === -1) return null;

      // Get last data row (most recent)
      const dataRows = lines.slice(1).filter((line: string) => line.trim());
      if (dataRows.length === 0) return null;

      const lastRow = dataRows[dataRows.length - 1].split(',');
      const rawNDVI = parseFloat(lastRow[ndviIndex]);
      const date = lastRow[dateIndex] || 'unknown';

      // MODIS NDVI is scaled by 10000, convert to -1 to 1 range
      const ndvi = rawNDVI / 10000;

      return {
        ndvi: Math.max(-1, Math.min(1, ndvi)),
        date,
        source: 'AppEEARS MOD13Q1.061',
      };
    } catch (error) {
      console.error('Error extracting NDVI from results:', error.message);
      return null;
    }
  }

  /**
   * Format date as MM-DD-YYYY for AppEEARS API
   */
  private formatDateForAppEEARS(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Quick NDVI estimate (fallback if AppEEARS is slow/unavailable)
   * Uses simpler API or cached data
   */
  async getQuickNDVI(lat: number, lng: number): Promise<number> {
    // For now, return estimated value
    // Could be replaced with a faster API or pre-cached NDVI grid
    const absLat = Math.abs(lat);
    let baseNDVI = 0.6;
    if (absLat < 10) baseNDVI = 0.75;
    else if (absLat < 30) baseNDVI = 0.55;
    else if (absLat < 60) baseNDVI = 0.45;
    else baseNDVI = 0.2;

    return baseNDVI;
  }
}
