import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MapController } from './map.controller';
import { MapService } from './map.service';
import { PlanningService } from './planning.service';
import { DataModule } from '../data/data.module';
import { NasaModule } from '../nasa/nasa.module';

@Module({
  imports: [HttpModule, ConfigModule, DataModule, NasaModule],
  controllers: [MapController],
  providers: [MapService, PlanningService],
})
export class MapModule {}
