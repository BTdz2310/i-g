import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ReconcileService } from '../reconcile/reconcile.service';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { CsrfGuard } from '../admin-auth/csrf.guard';
import { parsePaginationQuery, buildPageResponse, buildKeysetWhere } from '../common/pagination/keyset';
import { ApiAdminAuth } from '../common/decorators/api-admin-auth.decorator';

@ApiExcludeController()
@ApiTags('admin-transactions')
@UseGuards(AdminAuthGuard)
@Controller('admin/transactions')
export class AdminTransactionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconcile: ReconcileService,
  ) {}

  @Get()
  @ApiAdminAuth()
  async listTransactions(
    @Query('status') status?: string,
    @Query('partnerId') partnerId?: string,
    @Query('policyNumber') policyNumber?: string,
    @Query('maGiaodich') maGiaodich?: string,
    @Query('productKind') productKind?: string,
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
      ...(status ? { status: status as any } : {}),
      ...(partnerId ? { partnerId } : {}),
      ...(policyNumber ? { policyNumber } : {}),
      ...(maGiaodich ? { maGiaodich } : {}),
      ...(productKind ? { productKind } : {}),
      ...timeFilter,
      ...(cursorWhere ?? {}),
    };

    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      select: {
        id: true,
        maGiaodich: true,
        status: true,
        productKind: true,
        policyNumber: true,
        createdAt: true,
        updatedAt: true,
        partner: { select: { id: true, name: true } },
      },
    });

    return buildPageResponse(rows as (typeof rows[0] & { id: string; createdAt: Date })[], take);
  }

  @Get(':id')
  @ApiAdminAuth()
  async getTransaction(@Param('id') id: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        partner: { select: { id: true, name: true } },
      },
    });
    if (!tx) throw new NotFoundException('Transaction not found');

    const apiCallLogs = await this.prisma.apiCallLog.findMany({
      where: { maGiaodich: tx.maGiaodich },
      orderBy: { createdAt: 'asc' },
    });

    const pdfUrl = tx.maGiaodich ? `/files/policies/${tx.maGiaodich}.pdf` : null;

    return { ...tx, apiCallLogs, pdfUrl };
  }

  @Post(':id/reconcile')
  @ApiAdminAuth()
  @UseGuards(CsrfGuard)
  async reconcileTransaction(@Param('id') id: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');
    return this.reconcile.reconcileOne(tx.maGiaodich);
  }
}
