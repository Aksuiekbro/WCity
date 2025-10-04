import { Module } from '@nestjs/common';
import { NormalizationService } from './normalization.service';
import { ScoringService } from './scoring.service';
import { InfrastructureService } from './infrastructure.service';
import { NasaModule } from '../nasa/nasa.module';

@Module({
  imports: [NasaModule],
  providers: [NormalizationService, ScoringService, InfrastructureService],
  exports: [NormalizationService, ScoringService, InfrastructureService],
})
export class DataModule {}
