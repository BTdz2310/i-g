import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';

const makeContext = (headers: Record<string, string>) => ({
  switchToHttp: () => ({
    getRequest: () => ({ headers }),
  }),
});

describe('AdminAuthGuard', () => {
  const mockJwtService = {
    verify: jest.fn(),
  };

  let guard: AdminAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new AdminAuthGuard(mockJwtService as any);
  });

  it('throws when Authorization header is missing', () => {
    const ctx = makeContext({});
    expect(() => guard.canActivate(ctx as any)).toThrow(UnauthorizedException);
  });

  it('throws when header does not start with Bearer', () => {
    const ctx = makeContext({ authorization: 'Basic abc123' });
    expect(() => guard.canActivate(ctx as any)).toThrow(UnauthorizedException);
  });

  it('throws when token is invalid', () => {
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });
    const ctx = makeContext({ authorization: 'Bearer bad-token' });
    expect(() => guard.canActivate(ctx as any)).toThrow(UnauthorizedException);
  });

  it('returns true and attaches admin on valid token', () => {
    mockJwtService.verify.mockReturnValue({
      adminId: 'uuid-1',
      username: 'admin',
    });
    const req: any = { headers: { authorization: 'Bearer valid-token' } };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) };
    const result = guard.canActivate(ctx as any);
    expect(result).toBe(true);
    expect(req.admin).toEqual({ id: 'uuid-1', username: 'admin' });
  });
});
