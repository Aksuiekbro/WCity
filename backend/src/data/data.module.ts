import { Module } from '@nestjs/common';
import { NormalizationService } from './normalization.service';
import { ScoringService } from './scoring.service';
import { NasaModule } from '../nasa/nasa.module';

@Module({
  imports: [NasaModule],
  providers: [NormalizationService, ScoringService],
  exports: [NormalizationService, ScoringService],
})
export class DataModule {}
