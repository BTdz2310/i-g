import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { PviModule } from './pvi/pvi.module';
import { ProxyModule } from './proxy/proxy.module';
import { CallbackModule } from './callback/callback.module';
import { ReconcileModule } from './reconcile/reconcile.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    PviModule,
    ProxyModule,
    CallbackModule,
    ReconcileModule,
    AdminModule,
  ],
})
export class AppModule {}
