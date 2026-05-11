import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ReconcileModule } from '../reconcile/reconcile.module';

@Module({
  imports: [ReconcileModule],
  controllers: [AdminController],
})
export class AdminModule {}
