import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PartnerAuthModule } from '../partner-auth/partner-auth.module';
import { ReconcileModule } from '../reconcile/reconcile.module';
import { TransactionController } from './transaction.controller';

@Module({
  imports: [PrismaModule, PartnerAuthModule, ReconcileModule],
  controllers: [TransactionController],
})
export class TransactionModule {}
