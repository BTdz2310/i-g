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
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice('Bearer '.length).trim();
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
