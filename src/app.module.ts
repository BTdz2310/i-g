import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Redis } from 'ioredis';
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
    // 1 throttler duy nhất — limit mặc định cho mọi endpoint.
    // Các endpoint nhạy cảm override bằng @Throttle({ default: { limit, ttl } }).
    // Redis storage để share counter giữa các cluster workers.
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(
          new Redis(process.env.REDIS_URL!),
        ),
      }),
    }),
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
