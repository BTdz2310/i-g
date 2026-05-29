import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PviClient } from '../pvi/pvi.client';
import { getEnv } from '../config/env';

@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pvi: PviClient,
  ) {}

  @Cron('* * * * *') // runs every minute; actual gate inside
  async reconcile() {
    // Trong pm2 cluster, cron chạy trên MỌI instance -> đối soát trùng (gọi
    // PVI nhiều lần, reconcileAttempts tăng sai). Chỉ cho instance 0 chạy.
    // NODE_APP_INSTANCE do pm2 cluster gán (0,1,2..); undefined khi chạy đơn lẻ.
    const appInstance = process.env.NODE_APP_INSTANCE;
    if (appInstance !== undefined && appInstance !== '0') return;

    const env = getEnv();
    const graceCutoff = new Date(Date.now() - env.RECONCILE_GRACE_MIN * 60_000);

    const pending = await this.prisma.transaction.findMany({
      where: {
        status: 'SUBMITTED_OK',
        updatedAt: { lt: graceCutoff },
        reconcileAttempts: { lt: env.RECONCILE_MAX_ATTEMPTS },
      },
    });

    if (pending.length === 0) return;

    this.logger.log(
      `Reconcile: checking ${pending.length} pending transaction(s)`,
    );

    for (const tx of pending) {
      try {
        const result = await this.pvi.getPolicy(tx.maGiaodich);

        if (result.PolicyNumber) {
          await this.prisma.transaction.update({
            where: { id: tx.id },
            data: {
              status: 'ISSUED',
              policyNumber: result.PolicyNumber,
              serialNumber: result.SerialNumber,
              pdfUrl: result.URL,
              reconcileAttempts: { increment: 1 },
            },
          });
          this.logger.log(`Reconcile ISSUED: ${tx.maGiaodich}`);
        } else {
          await this.incrementAttempts(
            tx.id,
            tx.reconcileAttempts + 1,
            env.RECONCILE_MAX_ATTEMPTS,
            'No policy yet',
          );
        }
      } catch (err) {
        const msg = (err as Error).message;
        this.logger.warn(`Reconcile error for ${tx.maGiaodich}: ${msg}`);
        await this.incrementAttempts(
          tx.id,
          tx.reconcileAttempts + 1,
          env.RECONCILE_MAX_ATTEMPTS,
          msg,
        );
      }
    }
  }

  private async incrementAttempts(
    id: string,
    newAttempts: number,
    max: number,
    lastError: string,
  ) {
    const nextStatus = newAttempts >= max ? 'CALLBACK_TIMEOUT' : 'SUBMITTED_OK';
    await this.prisma.transaction.update({
      where: { id },
      data: {
        reconcileAttempts: newAttempts,
        status: nextStatus,
        lastError,
      },
    });
    if (nextStatus === 'CALLBACK_TIMEOUT') {
      this.logger.error(
        `Transaction ${id} hit CALLBACK_TIMEOUT after ${newAttempts} attempts`,
      );
    }
  }

  async reconcileOne(
    maGiaodich: string,
  ): Promise<{ status: string; policyNumber?: string | null }> {
    const tx = await this.prisma.transaction.findUniqueOrThrow({
      where: { maGiaodich },
    });
    const result = await this.pvi.getPolicy(maGiaodich);

    if (result.PolicyNumber) {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: 'ISSUED',
          policyNumber: result.PolicyNumber,
          serialNumber: result.SerialNumber,
          pdfUrl: result.URL,
          reconcileAttempts: { increment: 1 },
        },
      });
      return { status: 'ISSUED', policyNumber: result.PolicyNumber };
    }

    return { status: tx.status, policyNumber: tx.policyNumber };
  }
}
