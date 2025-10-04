import { Controller, Get, Query } from '@nestjs/common';
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
    @Query('layerType') layerType: string,
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
}
