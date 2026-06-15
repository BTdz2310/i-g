import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminJwtService } from './jwt.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly jwtService: AdminJwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    let token: string | undefined;

    // Cookie takes priority; Bearer fallback for cURL smoke tests
    const cookieToken = (req.cookies as Record<string, string>)?.['access_token'];
    if (cookieToken) {
      token = cookieToken;
    } else {
      const header = req.headers['authorization'];
      if (header?.startsWith('Bearer ')) {
        token = header.slice('Bearer '.length).trim();
      }
    }

    if (!token) throw new UnauthorizedException('Missing token');

    try {
      const payload = this.jwtService.verify(token);
      (req as Request & { admin?: { id: string; username: string } }).admin = {
        id: payload.adminId,
        username: payload.username,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
