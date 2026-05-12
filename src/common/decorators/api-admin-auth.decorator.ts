import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AdminAuthGuard } from '../../admin-auth/admin-auth.guard';

export function ApiAdminAuth() {
  return applyDecorators(
    UseGuards(AdminAuthGuard),
    ApiBearerAuth('admin-jwt'),
    ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' }),
  );
}
