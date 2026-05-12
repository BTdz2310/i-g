import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { getEnv } from '../config/env';

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedFromEnv();
  }

  async findByUsername(username: string) {
    return this.prisma.admin.findUnique({ where: { username } });
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  private async seedFromEnv() {
    const env = getEnv();
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
      this.logger.warn(
        'ADMIN_USERNAME / ADMIN_PASSWORD not set — skipping admin seed',
      );
      return;
    }
    const count = await this.prisma.admin.count();
    if (count > 0) return;

    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
    await this.prisma.admin.create({
      data: { username: env.ADMIN_USERNAME, passwordHash },
    });
    this.logger.log(`Seeded initial admin: ${env.ADMIN_USERNAME}`);
  }
}
