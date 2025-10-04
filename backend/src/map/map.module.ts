import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { MapController } from './map.controller';
import { MapService } from './map.service';
import { DataModule } from '../data/data.module';
import { NasaModule } from '../nasa/nasa.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    CacheModule.register({
      ttl: 900000, // 15 minutes
      max: 100, // maximum number of items in cache
    }),
    DataModule,
    NasaModule,
  ],
  controllers: [MapController],
  providers: [MapService],
})
export class MapModule {}
