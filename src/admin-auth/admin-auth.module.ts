import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminJwtService } from './jwt.service';
import { AdminService } from './admin.service';

@Module({
  imports: [PrismaModule],
  providers: [AdminService, AdminJwtService, AdminAuthGuard],
  exports: [AdminService, AdminJwtService, AdminAuthGuard],
})
export class AdminAuthModule {}
