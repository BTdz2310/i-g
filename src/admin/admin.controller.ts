import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartnerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerService } from '../partner-auth/partner.service';
import { AdminService } from '../admin-auth/admin.service';
import { AdminJwtService } from '../admin-auth/jwt.service';
import { ApiAdminAuth } from '../common/decorators/api-admin-auth.decorator';
import { LoginDto } from '../admin-auth/dto/login.dto';
import { LoginResultDto } from '../admin-auth/dto/login-result.dto';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { CreatePartnerResultDto } from './dto/create-partner-result.dto';
import { RotatePartnerSecretDto } from './dto/rotate-partner-secret.dto';
import { RotatePartnerSecretResultDto } from './dto/rotate-partner-secret-result.dto';
import { UpdatePartnerStatusDto } from './dto/update-partner-status.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly partnerService: PartnerService,
    private readonly adminService: AdminService,
    private readonly adminJwt: AdminJwtService,
  ) {}

  @Post('auth/login')
  @ApiOperation({ summary: 'Admin đăng nhập' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: LoginResultDto })
  async login(@Body() body: LoginDto): Promise<LoginResultDto> {
    const admin = await this.adminService.findByUsername(body.username);
    if (!admin) throw new UnauthorizedException('Invalid credentials');
    const ok = await this.adminService.verifyPassword(
      body.password,
      admin.passwordHash,
    );
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.adminJwt.sign({
      adminId: admin.id,
      username: admin.username,
    });
  }

  @Post('partners')
  @ApiAdminAuth()
  @ApiOperation({ summary: 'Tạo đối tác cấp 2' })
  @ApiBody({ type: CreatePartnerDto })
  @ApiOkResponse({ type: CreatePartnerResultDto })
  async createPartner(@Body() body: CreatePartnerDto) {
    const result = await this.partnerService.createPartner({
      name: body.name,
      clientId: body.clientId,
      rateLimit: body.rateLimit,
      allowedIps: body.allowedIps,
      status: body.status as PartnerStatus | undefined,
    });

    return {
      id: result.partner.id,
      clientId: result.partner.clientId,
      keyId: result.keyId,
      secret: result.secret,
    };
  }

  @Get('partners')
  @ApiAdminAuth()
  @ApiOperation({ summary: 'Danh sách đối tác cấp 2' })
  listPartners() {
    return this.partnerService.listPartners();
  }

  @Post('partners/:id/rotate-secret')
  @ApiAdminAuth()
  @ApiOperation({ summary: 'Rotate secret cho đối tác' })
  @ApiBody({ type: RotatePartnerSecretDto })
  @ApiOkResponse({ type: RotatePartnerSecretResultDto })
  async rotatePartnerSecret(
    @Param('id') id: string,
    @Body() body: RotatePartnerSecretDto,
  ) {
    const result = await this.partnerService.rotateSecret(
      id,
      body.revokeOld ?? false,
    );
    if (!result) throw new NotFoundException();
    return result;
  }

  @Patch('partners/:id/status')
  @ApiAdminAuth()
  @ApiOperation({ summary: 'Bật/tắt đối tác' })
  @ApiBody({ type: UpdatePartnerStatusDto })
  async updatePartnerStatus(
    @Param('id') id: string,
    @Body() body: UpdatePartnerStatusDto,
  ) {
    return this.partnerService.updateStatus(id, body.status as PartnerStatus);
  }

  @Patch('partners/:id')
  @ApiAdminAuth()
  @ApiOperation({ summary: 'Cập nhật đối tác (name / rateLimit / allowedIps / status)' })
  @ApiBody({ type: UpdatePartnerDto })
  async updatePartner(
    @Param('id') id: string,
    @Body() body: UpdatePartnerDto,
  ) {
    const result = await this.partnerService.updatePartner(id, {
      name: body.name,
      rateLimit: body.rateLimit,
      allowedIps: body.allowedIps,
      status: body.status as PartnerStatus | undefined,
    });
    if (!result) throw new NotFoundException();
    return result;
  }

  @Get('api-logs')
  @ApiAdminAuth()
  @ApiOperation({ summary: 'Danh sách API logs' })
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
