import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SignService } from '../pvi/sign.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CallbackPayload } from '../pvi/dto/callback.dto';

@ApiTags('callback')
@Controller('pvi/callback')
export class CallbackController {
  private readonly logger = new Logger(CallbackController.name);

  constructor(
    private readonly sign: SignService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Nhận callback từ PVI khi phát hành đơn' })
  async handleCallback(@Body() payload: CallbackPayload) {
    const start = Date.now();

    const valid = this.sign.verifyCallback({
      RequestId: payload.RequestId,
      PolicyNumber: payload.PolicyNumber,
      URL: payload.URL,
      Sign: payload.Sign,
    });

    if (!valid) {
      this.logger.warn(
        `Callback sign mismatch for RequestId=${payload.RequestId}`,
      );
      await this.audit.logIn(
        '/pvi/callback',
        payload,
        200,
        Date.now() - start,
        payload.RequestId,
      );
      return { Status: '-105', Message: 'Invalid sign' };
    }

    const tx = await this.prisma.transaction.findUnique({
      where: { maGiaodich: payload.RequestId },
    });

    if (!tx) {
      this.logger.warn(`Callback for unknown RequestId=${payload.RequestId}`);
      await this.audit.logIn(
        '/pvi/callback',
        payload,
        200,
        Date.now() - start,
        payload.RequestId,
      );
      return { Status: '-404', Message: 'Transaction not found' };
    }

    // Idempotent: already issued with same policy number
    if (tx.status === 'ISSUED' && tx.policyNumber === payload.PolicyNumber) {
      await this.audit.logIn(
        '/pvi/callback',
        payload,
        200,
        Date.now() - start,
        payload.RequestId,
      );
      return { Status: '00', Message: 'OK' };
    }

    await this.prisma.transaction.update({
      where: { maGiaodich: payload.RequestId },
      data: {
        status: 'ISSUED',
        policyNumber: payload.PolicyNumber,
        serialNumber: payload.SerialNumber,
        pdfUrl: payload.URL,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        callbackPayload: payload as any,
        callbackAt: new Date(),
        callbackCardId: payload.CardId,
        callbackCpId: payload.CpId,
      },
    });

    await this.audit.logIn(
      '/pvi/callback',
      payload,
      200,
      Date.now() - start,
      payload.RequestId,
    );
    this.logger.log(
      `Policy issued: RequestId=${payload.RequestId} PolicyNumber=${payload.PolicyNumber}`,
    );

    return { Status: '00', Message: 'OK' };
  }
}
