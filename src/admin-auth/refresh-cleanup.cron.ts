import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RefreshCleanupCron {
  private readonly logger = new Logger(RefreshCleanupCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *') // daily at 03:00
  async pruneExpiredTokens(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
    const result = await this.prisma.adminRefreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: sevenDaysAgo } },
        ],
      },
    });
    this.logger.log(`Pruned ${result.count} expired refresh token(s)`);
  }
}
