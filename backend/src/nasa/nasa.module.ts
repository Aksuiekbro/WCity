import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PowerService } from './services/power.service';
import { SedacService } from './services/sedac.service';
import { GldasService } from './services/gldas.service';
import { ModisService } from './services/modis.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [PowerService, SedacService, GldasService, ModisService],
  exports: [PowerService, SedacService, GldasService, ModisService],
})
export class NasaModule {}
