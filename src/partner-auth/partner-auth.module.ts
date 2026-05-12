import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NonceStoreService } from './nonce-store.service';
import { PartnerAuthGuard } from './partner-auth.guard';
import { PartnerSecretService } from './partner-secret.service';
import { PartnerService } from './partner.service';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from './redis.service';
import { SignatureService } from './signature.service';

@Module({
  imports: [PrismaModule],
  providers: [
    RedisService,
    NonceStoreService,
    RateLimitService,
    PartnerSecretService,
    PartnerService,
    SignatureService,
    PartnerAuthGuard,
  ],
  exports: [
    RedisService,
    NonceStoreService,
    RateLimitService,
    PartnerSecretService,
    PartnerService,
    SignatureService,
    PartnerAuthGuard,
  ],
})
export class PartnerAuthModule {}
