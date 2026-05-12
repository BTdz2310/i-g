import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PartnerAuthModule } from '../partner-auth/partner-auth.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Module({
  imports: [PartnerAuthModule, AdminAuthModule],
  controllers: [AdminController],
})
export class AdminModule {}
