import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ReconcileService } from '../reconcile/reconcile.service';
import { TxStatus } from '@prisma/client';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconcile: ReconcileService,
  ) {}

  @Get('transactions')
  listTransactions(
    @Query('status') status?: string,
    @Query('policyNumber') policyNumber?: string,
    @Query('bks') bks?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.prisma.transaction.findMany({
      where: {
        ...(status ? { status: status as TxStatus } : {}),
        ...(policyNumber ? { policyNumber } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get('transactions/:id')
  async getTransaction(@Param('id') id: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException();

    const logs = await this.prisma.apiCallLog.findMany({
      where: { maGiaodich: tx.maGiaodich },
      orderBy: { createdAt: 'asc' },
    });

    return { ...tx, apiCallLogs: logs };
  }

  @Post('transactions/:id/reconcile')
  async triggerReconcile(@Param('id') id: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException();
    return this.reconcile.reconcileOne(tx.maGiaodich);
  }

  @Get('api-logs')
  listApiLogs(
    @Query('maGiaodich') maGiaodich?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.prisma.apiCallLog.findMany({
      where: {
        ...(maGiaodich ? { maGiaodich } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
