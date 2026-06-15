import { Module } from '@nestjs/common';
import { PartnerAuthModule } from '../partner-auth/partner-auth.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReconcileModule } from '../reconcile/reconcile.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminPartnersController } from './admin-partners.controller';
import { AdminTransactionsController } from './admin-transactions.controller';
import { AdminStatsController } from './admin-stats.controller';
import { AdminApiLogsController } from './admin-api-logs.controller';

@Module({
  imports: [PartnerAuthModule, AdminAuthModule, PrismaModule, ReconcileModule],
  controllers: [
    AdminAuthController,
    AdminPartnersController,
    AdminTransactionsController,
    AdminStatsController,
    AdminApiLogsController,
  ],
})
export class AdminModule {}
