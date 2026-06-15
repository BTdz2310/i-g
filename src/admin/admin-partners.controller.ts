import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiExcludeController, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartnerService } from '../partner-auth/partner.service';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { CsrfGuard } from '../admin-auth/csrf.guard';
import { ApiAdminAuth } from '../common/decorators/api-admin-auth.decorator';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { CreatePartnerResultDto } from './dto/create-partner-result.dto';
import { RotatePartnerSecretDto } from './dto/rotate-partner-secret.dto';
import { RotatePartnerSecretResultDto } from './dto/rotate-partner-secret-result.dto';
import { UpdatePartnerStatusDto } from './dto/update-partner-status.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@ApiExcludeController()
@ApiTags('admin-partners')
@UseGuards(AdminAuthGuard)
@Controller('admin/partners')
export class AdminPartnersController {
  constructor(private readonly partnerService: PartnerService) {}

  @Post()
  @UseGuards(CsrfGuard)
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
      status: body.status,
    });
    return {
      id: result.partner.id,
      clientId: result.partner.clientId,
      keyId: result.keyId,
      secret: result.secret,
    };
  }

  @Get()
  @ApiAdminAuth()
  @ApiOperation({ summary: 'Danh sách đối tác cấp 2' })
  listPartners() {
    return this.partnerService.listPartners();
  }

  @Post(':id/rotate-secret')
  @UseGuards(CsrfGuard)
  @ApiAdminAuth()
  @ApiOperation({ summary: 'Rotate secret cho đối tác' })
  @ApiBody({ type: RotatePartnerSecretDto })
  @ApiOkResponse({ type: RotatePartnerSecretResultDto })
  async rotatePartnerSecret(
    @Param('id') id: string,
    @Body() body: RotatePartnerSecretDto,
  ) {
    const result = await this.partnerService.rotateSecret(id, body.revokeOld ?? false);
    if (!result) throw new NotFoundException();
    return result;
  }

  @Patch(':id/status')
  @UseGuards(CsrfGuard)
  @ApiAdminAuth()
  @ApiOperation({ summary: 'Bật/tắt đối tác' })
  @ApiBody({ type: UpdatePartnerStatusDto })
  async updatePartnerStatus(@Param('id') id: string, @Body() body: UpdatePartnerStatusDto) {
    return this.partnerService.updateStatus(id, body.status);
  }

  @Patch(':id')
  @UseGuards(CsrfGuard)
  @ApiAdminAuth()
  @ApiOperation({ summary: 'Cập nhật đối tác (name / rateLimit / allowedIps / status)' })
  @ApiBody({ type: UpdatePartnerDto })
  async updatePartner(@Param('id') id: string, @Body() body: UpdatePartnerDto) {
    const result = await this.partnerService.updatePartner(id, {
      name: body.name,
      rateLimit: body.rateLimit,
      allowedIps: body.allowedIps,
      status: body.status,
    });
    if (!result) throw new NotFoundException();
    return result;
  }
}
