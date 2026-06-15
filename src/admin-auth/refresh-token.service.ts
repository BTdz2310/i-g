import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { getEnv } from '../config/env';

interface TokenMeta {
  userAgent?: string;
  ip?: string;
}

interface IssuedToken {
  rawToken: string;
  familyId: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(rawToken: string): string {
    const env = getEnv();
    return createHmac('sha256', env.ADMIN_REFRESH_SECRET)
      .update(rawToken)
      .digest('hex');
  }

  async issue(
    adminId: string,
    familyId?: string,
    meta?: TokenMeta,
  ): Promise<IssuedToken> {
    const env = getEnv();
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hash(rawToken);
    const resolvedFamilyId = familyId ?? randomUUID();
    const expiresAt = new Date(
      Date.now() + env.ADMIN_REFRESH_TOKEN_TTL_DAYS * 86_400_000,
    );

    await this.prisma.adminRefreshToken.create({
      data: {
        adminId,
        tokenHash,
        familyId: resolvedFamilyId,
        expiresAt,
        userAgent: meta?.userAgent,
        ip: meta?.ip,
      },
    });

    return { rawToken, familyId: resolvedFamilyId, expiresAt };
  }

  async rotate(rawToken: string, meta?: TokenMeta): Promise<IssuedToken> {
    const tokenHash = this.hash(rawToken);
    const row = await this.prisma.adminRefreshToken.findUnique({
      where: { tokenHash },
    });

    if (!row) throw new UnauthorizedException('Invalid refresh token');

    if (row.revokedAt !== null) {
      // Reuse detected — revoke entire family
      await this.prisma.adminRefreshToken.updateMany({
        where: { familyId: row.familyId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token reuse detected');
    }

    if (row.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const newToken = await this.issue(row.adminId, row.familyId, meta);

    const newRow = await this.prisma.adminRefreshToken.findUnique({
      where: { tokenHash: this.hash(newToken.rawToken) },
    });

    await this.prisma.adminRefreshToken.update({
      where: { id: row.id },
      data: {
        revokedAt: new Date(),
        replacedById: newRow!.id,
      },
    });

    return newToken;
  }

  async revoke(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken);
    await this.prisma.adminRefreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.adminRefreshToken.updateMany({
      where: { familyId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForAdmin(adminId: string): Promise<void> {
    await this.prisma.adminRefreshToken.updateMany({
      where: { adminId },
      data: { revokedAt: new Date() },
    });
  }

  async getFamilyId(rawToken: string): Promise<string | null> {
    const tokenHash = this.hash(rawToken);
    const row = await this.prisma.adminRefreshToken.findUnique({
      where: { tokenHash },
      select: { familyId: true },
    });
    return row?.familyId ?? null;
  }

  async getAdminForToken(
    rawToken: string,
  ): Promise<{ adminId: string; username: string } | null> {
    const tokenHash = this.hash(rawToken);
    const row = await this.prisma.adminRefreshToken.findUnique({
      where: { tokenHash },
      include: { admin: { select: { id: true, username: true } } },
    });
    if (!row) return null;
    return { adminId: row.admin.id, username: row.admin.username };
  }
}
