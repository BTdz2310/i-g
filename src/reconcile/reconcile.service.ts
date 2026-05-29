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

  // Khoá toàn cục cho cron reconcile. Cron chạy trên MỌI pm2 instance của
  // MỌI BE server -> phải đảm bảo chỉ 1 cái thực sự chạy mỗi phút, nếu không
  // sẽ gọi PVI getPolicy trùng + reconcileAttempts tăng sai.
  private static readonly RECONCILE_LOCK_KEY = 987654321;

  @Cron('* * * * *') // runs every minute; global advisory lock gates inside
  async reconcile() {
    const env = getEnv();

    // Giành Postgres advisory lock toàn cục (session-level). Trả false ngay
    // nếu instance/máy khác đang giữ -> bỏ qua, không chờ. Lock ở tầng DB nên
    // đúng cho cả pm2 cluster lẫn nhiều BE server. KHÔNG bọc cả vòng reconcile
    // trong $transaction vì reconcile gọi PVI getPolicy (chậm) -> sẽ vượt
    // transaction timeout của Prisma. Thay vào đó giữ session lock qua suốt
    // vòng chạy rồi nhả ở finally.
    const lockRows = await this.prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(${ReconcileService.RECONCILE_LOCK_KEY}) AS locked
    `;
    if (!lockRows[0]?.locked) return;

    try {
      await this.runReconcile(env);
    } finally {
      await this.prisma
        .$queryRaw`SELECT pg_advisory_unlock(${ReconcileService.RECONCILE_LOCK_KEY})`;
    }
  }

  private async runReconcile(env: ReturnType<typeof getEnv>) {
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
