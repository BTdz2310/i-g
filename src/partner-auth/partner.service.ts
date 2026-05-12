import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerSecretService } from './partner-secret.service';
import { PartnerStatus, SecretStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class PartnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretService: PartnerSecretService,
  ) {}

  async findActivePartnerByClientId(clientId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { clientId },
      select: {
        id: true,
        name: true,
        clientId: true,
        status: true,
        rateLimit: true,
        allowedIps: true,
      },
    });
    if (!partner || partner.status !== PartnerStatus.ACTIVE) return null;
    return partner;
  }

  async getActiveSecret(partnerId: string, keyId: string) {
    const secret = await this.prisma.partnerSecret.findFirst({
      where: {
        partnerId,
        keyId,
        status: SecretStatus.ACTIVE,
      },
      select: { secretEnc: true },
    });
    if (!secret) return null;
    return this.secretService.decrypt(secret.secretEnc);
  }

  async createPartner(input: {
    name: string;
    clientId?: string;
    rateLimit?: number;
    allowedIps?: string[];
    status?: PartnerStatus;
  }) {
    const clientId = input.clientId ?? randomUUID();
    const keyId = randomUUID();
    const secret = this.secretService.generateSecret();
    const secretEnc = this.secretService.encrypt(secret);

    const partner = await this.prisma.partner.create({
      data: {
        name: input.name,
        clientId,
        status: input.status ?? PartnerStatus.ACTIVE,
        rateLimit: input.rateLimit ?? 0,
        allowedIps: input.allowedIps ?? [],
        secrets: {
          create: {
            keyId,
            secretEnc,
            status: SecretStatus.ACTIVE,
          },
        },
      },
      select: {
        id: true,
        name: true,
        clientId: true,
        status: true,
        rateLimit: true,
        allowedIps: true,
      },
    });

    return { partner, keyId, secret };
  }

  async rotateSecret(partnerId: string, revokeOld = false) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true },
    });
    if (!partner) return null;

    const keyId = randomUUID();
    const secret = this.secretService.generateSecret();
    const secretEnc = this.secretService.encrypt(secret);

    await this.prisma.partnerSecret.create({
      data: {
        partnerId,
        keyId,
        secretEnc,
        status: SecretStatus.ACTIVE,
      },
    });

    if (revokeOld) {
      await this.prisma.partnerSecret.updateMany({
        where: { partnerId, keyId: { not: keyId } },
        data: { status: SecretStatus.REVOKED },
      });
    }

    return { keyId, secret };
  }

  async updatePartner(
    partnerId: string,
    input: {
      name?: string;
      rateLimit?: number;
      allowedIps?: string[];
      status?: PartnerStatus;
    },
  ) {
    const exists = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true },
    });
    if (!exists) return null;

    return this.prisma.partner.update({
      where: { id: partnerId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.rateLimit !== undefined ? { rateLimit: input.rateLimit } : {}),
        ...(input.allowedIps !== undefined ? { allowedIps: input.allowedIps } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: {
        id: true,
        name: true,
        clientId: true,
        status: true,
        rateLimit: true,
        allowedIps: true,
      },
    });
  }

  async updateStatus(partnerId: string, status: PartnerStatus) {
    return this.prisma.partner.update({
      where: { id: partnerId },
      data: { status },
      select: {
        id: true,
        name: true,
        clientId: true,
        status: true,
        rateLimit: true,
        allowedIps: true,
      },
    });
  }

  listPartners() {
    return this.prisma.partner.findMany({
      select: {
        id: true,
        name: true,
        clientId: true,
        status: true,
        rateLimit: true,
        allowedIps: true,
        createdAt: true,
        secrets: {
          select: {
            id: true,
            keyId: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
