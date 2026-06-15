import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AdminService } from '../admin-auth/admin.service';
import { AdminJwtService } from '../admin-auth/jwt.service';
import { RefreshTokenService } from '../admin-auth/refresh-token.service';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { setAuthCookies, clearAuthCookies } from '../admin-auth/cookie.util';
import { CsrfGuard } from '../admin-auth/csrf.guard';
import { LoginDto } from '../admin-auth/dto/login.dto';

type AuthRequest = Request & { admin?: { id: string; username: string } };

@ApiExcludeController()
@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminJwt: AdminJwtService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const admin = await this.adminService.findByUsername(body.username);
    if (!admin) throw new UnauthorizedException('Invalid credentials');
    const ok = await this.adminService.verifyPassword(body.password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const { token, expiresIn } = this.adminJwt.sign({ adminId: admin.id, username: admin.username });
    const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
    const { rawToken, expiresAt } = await this.refreshTokens.issue(admin.id, undefined, meta);

    setAuthCookies(res, token, rawToken, expiresAt);
    return { username: admin.username, expiresIn };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = (req.cookies as Record<string, string>)?.['refresh_token'];
    if (!rawToken) throw new UnauthorizedException('Missing refresh token');

    const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
    const newToken = await this.refreshTokens.rotate(rawToken, meta);

    const adminInfo = await this.refreshTokens.getAdminForToken(newToken.rawToken);
    if (!adminInfo) throw new UnauthorizedException('Invalid session');

    const { token, expiresIn } = this.adminJwt.sign({ adminId: adminInfo.adminId, username: adminInfo.username });
    setAuthCookies(res, token, newToken.rawToken, newToken.expiresAt);
    return { expiresIn };
  }

  @Post('logout')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = (req.cookies as Record<string, string>)?.['refresh_token'];
    if (rawToken) await this.refreshTokens.revoke(rawToken);
    clearAuthCookies(res);
    return { ok: true };
  }

  @Post('logout-all')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  async logoutAll(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    if (req.admin?.id) await this.refreshTokens.revokeAllForAdmin(req.admin.id);
    clearAuthCookies(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@Req() req: AuthRequest) {
    return { adminId: req.admin!.id, username: req.admin!.username };
  }
}
