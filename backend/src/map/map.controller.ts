import { Controller, Get, Query, Param } from '@nestjs/common';
import { MapService } from './map.service';

@Controller('api/map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('score')
  async getLocationScore(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return { error: 'Invalid coordinates' };
    }

    return await this.mapService.getLocationScore(latitude, longitude);
  }

  @Get('layers/:layerType')
  async getLayerData(
    @Query('bounds') bounds: string,
    @Param('layerType') layerType: string,
  ) {
    // Parse bounds: "lat1,lng1,lat2,lng2"
    const [lat1, lng1, lat2, lng2] = bounds.split(',').map(parseFloat);

    return await this.mapService.getLayerData(layerType, {
      lat1,
      lng1,
      lat2,
      lng2,
    });
  }

  @Get('timeseries')
  async getTimeSeries(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('metric') metric: string,
  ) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    return await this.mapService.getTimeSeries(latitude, longitude, metric);
  }

  @Get('recommendations')
  async getRecommendations(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return { error: 'Invalid coordinates' };
    }

    return await this.mapService.getRecommendations(latitude, longitude);
  }

  @Get('cities')
  async getCitiesInViewport(
    @Query('north') north: string,
    @Query('south') south: string,
    @Query('east') east: string,
    @Query('west') west: string,
  ) {
    // DISABLED: Population heatmap disabled to prevent GeoNames rate limiting
    // This endpoint was causing excessive API calls during zoom/pan operations
    // Population data is still available via the /score endpoint for individual points
    return { cities: [], note: 'Population heatmap disabled' };

    /* Original implementation - disabled to prevent rate limiting
    const bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west),
    };

    if (
      isNaN(bounds.north) ||
      isNaN(bounds.south) ||
      isNaN(bounds.east) ||
      isNaN(bounds.west)
    ) {
      return { error: 'Invalid bounding box coordinates' };
    }

    return await this.mapService.getCitiesInViewport(bounds);
    */
  }

  @Get('infrastructure')
  async getInfrastructure(
    @Query('type') type: string,
    @Query('north') north: string,
    @Query('south') south: string,
    @Query('east') east: string,
    @Query('west') west: string,
  ) {
    const allowed = new Set([
      'hospitals',
      'schools',
      'fire_stations',
      'police',
      'power_plants',
      'kindergartens',
      'universities',
      'orphanages',
      'nursing_homes',
    ]);
    if (!allowed.has(type)) {
      return { error: 'Invalid type. Allowed: hospitals, schools, fire_stations, police, power_plants, kindergartens, universities, orphanages, nursing_homes' };
    }

    const bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west),
    };

    if (
      isNaN(bounds.north) ||
      isNaN(bounds.south) ||
      isNaN(bounds.east) ||
      isNaN(bounds.west)
    ) {
      return { error: 'Invalid bounding box coordinates' };
    }

    return await this.mapService.getInfrastructure(type, bounds);
  }
}
