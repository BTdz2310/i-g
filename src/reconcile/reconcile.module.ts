import { Module } from '@nestjs/common';
import { PviModule } from '../pvi/pvi.module';
import { ReconcileService } from './reconcile.service';

@Module({
  imports: [PviModule],
  providers: [ReconcileService],
  exports: [ReconcileService],
})
export class ReconcileModule {}
