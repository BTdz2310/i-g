import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { ApiAdminAuth } from '../common/decorators/api-admin-auth.decorator';
import { parsePaginationQuery, buildPageResponse } from '../common/pagination/keyset';

@ApiExcludeController()
@ApiTags('admin-api-logs')
@UseGuards(AdminAuthGuard)
@Controller('admin/api-logs')
export class AdminApiLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiAdminAuth()
  async listApiLogs(
    @Query('direction') direction?: string,
    @Query('endpoint') endpoint?: string,
    @Query('maGiaodich') maGiaodich?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const { take, cursorWhere } = parsePaginationQuery({ limit, cursor });

    const timeFilter =
      from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {};

    const where = {
      ...(direction ? { direction } : {}),
      ...(endpoint ? { endpoint: { contains: endpoint } } : {}),
      ...(maGiaodich ? { maGiaodich } : {}),
      ...timeFilter,
      ...(cursorWhere ?? {}),
    };

    const rows = await this.prisma.apiCallLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });

    return buildPageResponse(rows, take);
  }
}
