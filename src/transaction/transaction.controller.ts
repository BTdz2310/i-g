import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { TxStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReconcileService } from '../reconcile/reconcile.service';
import { PartnerAuthGuard } from '../partner-auth/partner-auth.guard';
import { ApiPartnerAuth } from '../common/decorators/api-partner-auth.decorator';

@ApiTags('transaction')
@ApiPartnerAuth()
@UseGuards(PartnerAuthGuard)
@Controller('transaction')
export class TransactionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconcile: ReconcileService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách giao dịch của partner' })
  list(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('policyNumber') policyNumber?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const partnerId = (req as Request & { partner: { id: string } }).partner.id;
    return this.prisma.transaction.findMany({
      where: {
        partnerId,
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

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết giao dịch' })
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const partnerId = (req as Request & { partner: { id: string } }).partner.id;
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx || tx.partnerId !== partnerId) throw new NotFoundException();
    const logs = await this.prisma.apiCallLog.findMany({
      where: { maGiaodich: tx.maGiaodich },
      orderBy: { createdAt: 'asc' },
    });
    return { ...tx, apiCallLogs: logs };
  }

  @Post(':id/reconcile')
  @ApiOperation({ summary: 'Trigger đối soát giao dịch' })
  async reconcileOne(@Req() req: Request, @Param('id') id: string) {
    const partnerId = (req as Request & { partner: { id: string } }).partner.id;
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx || tx.partnerId !== partnerId) throw new NotFoundException();
    return this.reconcile.reconcileOne(tx.maGiaodich);
  }
}
