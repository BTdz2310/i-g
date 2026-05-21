import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { PviModule } from './pvi/pvi.module';
import { ProxyModule } from './proxy/proxy.module';
import { CallbackModule } from './callback/callback.module';
import { ReconcileModule } from './reconcile/reconcile.module';
import { AdminModule } from './admin/admin.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { TransactionModule } from './transaction/transaction.module';
import { DevModule } from './dev/dev.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Global rate limit: 100 req / 60s / IP. Partner endpoints có rate-limit
    // chặt hơn riêng ở [[partner-auth]]; cái này là baseline chống abuse.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuditModule,
    PviModule,
    ProxyModule,
    CallbackModule,
    ReconcileModule,
    AdminModule,
    AdminAuthModule,
    TransactionModule,
    DevModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
