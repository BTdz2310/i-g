import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminJwtService } from './jwt.service';
import { AdminService } from './admin.service';
import { RefreshTokenService } from './refresh-token.service';
import { CsrfGuard } from './csrf.guard';
import { RefreshCleanupCron } from './refresh-cleanup.cron';

@Module({
  imports: [PrismaModule],
  providers: [
    AdminService,
    AdminJwtService,
    AdminAuthGuard,
    RefreshTokenService,
    CsrfGuard,
    RefreshCleanupCron,
  ],
  exports: [AdminService, AdminJwtService, AdminAuthGuard, RefreshTokenService, CsrfGuard],
})
export class AdminAuthModule {}
