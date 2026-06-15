import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { ApiAdminAuth } from '../common/decorators/api-admin-auth.decorator';

@ApiExcludeController()
@ApiTags('admin-stats')
@UseGuards(AdminAuthGuard)
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  @ApiAdminAuth()
  async overview() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

    const [byStatus, todayCount, weekCount, activePartners] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.transaction.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.transaction.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.partner.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      todayCount,
      weekCount,
      activePartners,
    };
  }

  @Get('timeseries')
  @ApiAdminAuth()
  async timeseries(@Query('days') daysParam?: string) {
    const days = Math.min(Math.max(parseInt(daysParam ?? '7', 10) || 7, 1), 90);
    const since = new Date(Date.now() - days * 86_400_000);

    const rows = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS date, COUNT(*)::bigint AS count
      FROM "Transaction"
      WHERE "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      count: Number(r.count),
    }));
  }
}
