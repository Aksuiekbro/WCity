import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface POI {
  id: string;
  lat: number;
  lng: number;
  name: string;
  type: string;
}

@Injectable()
export class OverpassService {
  private readonly OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

  constructor(private readonly httpService: HttpService) {}

  /**
   * Query Overpass API for hospitals within viewport bounds
   */
  async getHospitalsInViewport(bounds: ViewportBounds): Promise<POI[]> {
    return this.queryOverpassPOI(bounds, 'hospital');
  }

  /**
   * Query Overpass API for schools within viewport bounds
   */
  async getSchoolsInViewport(bounds: ViewportBounds): Promise<POI[]> {
    return this.queryOverpassPOI(bounds, 'school');
  }

  /**
   * Generic method to query Overpass API for POIs by amenity type
   */
  private async queryOverpassPOI(
    bounds: ViewportBounds,
    amenityType: string,
  ): Promise<POI[]> {
    const { south, west, north, east } = bounds;

    // Overpass QL query for amenities (nodes, ways, and relations)
    const query = `
      [out:json][timeout:10];
      (
        node["amenity"="${amenityType}"](${south},${west},${north},${east});
        way["amenity"="${amenityType}"](${south},${west},${north},${east});
        relation["amenity"="${amenityType}"](${south},${west},${north},${east});
      );
      out center;
    `;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.OVERPASS_API_URL,
          `data=${encodeURIComponent(query)}`,
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000, // 15s timeout
          },
        ),
      );

      if (!response.data?.elements) {
        return [];
      }

      // Transform Overpass response to POI format
      const pois: POI[] = response.data.elements.map((element: any) => {
        // For ways/relations, use center coordinates; for nodes, use lat/lon
        const lat = element.center?.lat || element.lat;
        const lon = element.center?.lon || element.lon;
        const name = element.tags?.name || `Unnamed ${amenityType}`;

        return {
          id: element.id.toString(),
          lat,
          lng: lon,
          name,
          type: amenityType,
        };
      });

      return pois;
    } catch (error) {
      console.error(
        `Error fetching ${amenityType}s from Overpass API:`,
        error.message,
      );

      // Handle rate limiting gracefully
      if (error.response?.status === 429) {
        console.warn('Overpass API rate limit exceeded, returning empty array');
      }

      return [];
    }
  }
}
