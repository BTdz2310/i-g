import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../partner-auth/redis.service';

type DependencyState = 'up' | 'down';

interface HealthReport {
  status: 'ok' | 'error';
  uptime: number;
  timestamp: string;
  checks: Record<string, DependencyState>;
}

/**
 * Health-check endpoint cho PVI Sonar probe / load balancer.
 *
 * - `GET /health`: readiness sâu — kiểm tra DB + Redis. Trả 503 nếu bất kỳ
 *   dependency nào chết, để probe loại node hỏng khỏi pool (đạt yêu cầu HA).
 * - `GET /health/live`: liveness thuần — chỉ xác nhận process còn chạy.
 *
 * Không xác thực: probe của PVI gọi không kèm credential.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async ready(): Promise<HealthReport> {
    const [db, cache] = await Promise.all([this.checkDb(), this.checkRedis()]);

    const checks: Record<string, DependencyState> = {
      database: db,
      redis: cache,
    };
    const healthy = db === 'up' && cache === 'up';

    const report: HealthReport = {
      status: healthy ? 'ok' : 'error',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      checks,
    };

    if (!healthy) {
      // 503 → probe loại node này khỏi pool cho tới khi dependency hồi phục.
      throw new ServiceUnavailableException(report);
    }
    return report;
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  live(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }

  private async checkDb(): Promise<DependencyState> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch (err) {
      this.logger.error(
        `DB health check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 'down';
    }
  }

  private async checkRedis(): Promise<DependencyState> {
    try {
      const pong = await this.redis.getClient().ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch (err) {
      this.logger.error(
        `Redis health check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 'down';
    }
  }
}
