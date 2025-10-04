import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NormalizationService } from './normalization.service';
import { ScoringService } from './scoring.service';
import { InfrastructureService } from './infrastructure.service';
import { OverpassService } from './overpass.service';
import { NasaModule } from '../nasa/nasa.module';

@Module({
  imports: [NasaModule, HttpModule],
  providers: [NormalizationService, ScoringService, InfrastructureService, OverpassService],
  exports: [NormalizationService, ScoringService, InfrastructureService, OverpassService],
})
export class DataModule {}
