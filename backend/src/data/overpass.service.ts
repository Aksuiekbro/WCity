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

  /** Fire stations */
  async getFireStationsInViewport(bounds: ViewportBounds): Promise<POI[]> {
    return this.queryOverpassByKey(bounds, 'amenity', 'fire_station', 'fire_stations');
  }

  /** Police stations */
  async getPoliceInViewport(bounds: ViewportBounds): Promise<POI[]> {
    return this.queryOverpassByKey(bounds, 'amenity', 'police', 'police');
  }

  /** Kindergartens / childcare */
  async getKindergartensInViewport(bounds: ViewportBounds): Promise<POI[]> {
    return this.queryOverpassByKey(bounds, 'amenity', '^(kindergarten|childcare)$', 'kindergartens');
  }

  /** Universities */
  async getUniversitiesInViewport(bounds: ViewportBounds): Promise<POI[]> {
    return this.queryOverpassByKey(bounds, 'amenity', 'university', 'universities');
  }

  /** Power plants */
  async getPowerPlantsInViewport(bounds: ViewportBounds): Promise<POI[]> {
    return this.queryOverpassByKey(bounds, 'power', 'plant', 'power_plants');
  }

  /** Orphanages (social facilities) */
  async getOrphanagesInViewport(bounds: ViewportBounds): Promise<POI[]> {
    // Use social_facility values; includes group_home commonly used for orphanages
    return this.queryOverpassByKey(bounds, 'social_facility', '^(orphanage|group_home)$', 'orphanages');
  }

  /** Nursing homes / assisted living (social facilities) */
  async getNursingHomesInViewport(bounds: ViewportBounds): Promise<POI[]> {
    return this.queryOverpassByKey(bounds, 'social_facility', '^(nursing_home|assisted_living)$', 'nursing_homes');
  }

  /**
   * Generic helper used by planning features to fetch arbitrary infrastructure tags.
   * This prevents duplicating Overpass QL fragments for every new infrastructure type.
   */
  async getInfrastructureByTag(
    bounds: ViewportBounds,
    key: string,
    valueOrRegex: string,
    typeLabel: string,
  ): Promise<POI[]> {
    return this.queryOverpassByKey(bounds, key, valueOrRegex, typeLabel);
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

  /** Generic key/value query with regex or exact value */
  private async queryOverpassByKey(
    bounds: ViewportBounds,
    key: string,
    valueOrRegex: string,
    resultType?: string,
  ): Promise<POI[]> {
    const { south, west, north, east } = bounds;
    // Build selector: [key="value"] or [key~"regex"] if contains regex markers
    const usesRegex = /[\^\$\|\(\)\[\]\+\?\*]/.test(valueOrRegex);
    const filter = usesRegex ? `["${key}"~"${valueOrRegex}"]` : `["${key}"="${valueOrRegex}"]`;
    const query = `
      [out:json][timeout:10];
      (
        node${filter}(${south},${west},${north},${east});
        way${filter}(${south},${west},${north},${east});
        relation${filter}(${south},${west},${north},${east});
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
            timeout: 15000,
          },
        ),
      );

      if (!response.data?.elements) {
        return [];
      }

      const pois: POI[] = response.data.elements.map((element: any) => {
        const lat = element.center?.lat || element.lat;
        const lon = element.center?.lon || element.lon;
        const name = element.tags?.name || `Unnamed ${resultType || key}`;
        return {
          id: element.id.toString(),
          lat,
          lng: lon,
          name,
          type: resultType || (usesRegex ? `${key}:${valueOrRegex}` : `${key}:${valueOrRegex}`),
        };
      });
      return pois;
    } catch (error) {
      console.error(`Error fetching ${resultType || `${key}=${valueOrRegex}` } from Overpass API:`, error.message);
      if (error.response?.status === 429) {
        console.warn('Overpass API rate limit exceeded, returning empty array');
      }
      return [];
    }
  }
}
