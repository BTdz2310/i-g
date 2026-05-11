import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { maskSensitive } from '../common/logger/mask.util';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logOut(
    endpoint: string,
    request: unknown,
    response: unknown,
    statusCode: number,
    durationMs: number,
    maGiaodich?: string,
    errorMsg?: string,
  ): Promise<void> {
    await this.prisma.apiCallLog.create({
      data: {
        direction: 'OUT_TO_PVI',
        endpoint,
        maGiaodich: maGiaodich ?? null,
        request: maskSensitive(request) as object,
        response: maskSensitive(response) as object,
        statusCode,
        durationMs,
        errorMsg: errorMsg ?? null,
      },
    });
  }

  async logIn(
    endpoint: string,
    request: unknown,
    statusCode: number,
    durationMs: number,
    maGiaodich?: string,
  ): Promise<void> {
    await this.prisma.apiCallLog.create({
      data: {
        direction: 'IN_FROM_PVI',
        endpoint,
        maGiaodich: maGiaodich ?? null,
        request: maskSensitive(request) as object,
        statusCode,
        durationMs,
      },
    });
  }
}
