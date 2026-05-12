# Plan: Admin Auth + tách `/transaction` khỏi `/admin`

Tài liệu này là plan triển khai để một developer (hoặc một LLM trong conversation khác) có thể đọc và thực thi **không cần thêm context**. Đọc xong là code được.

---

## 1. Bối cảnh hệ thống

Repo này là **Insurance Gateway** — một NestJS service đứng giữa các đối tác thương mại điện tử (AZ-Plus và các đối tác cấp 2 khác) và **PVI Core** (hệ thống cấp đơn bảo hiểm của Tổng công ty PVI).

- PVI Core chỉ cấp **một cặp `CpId + Key` duy nhất cho PVIS** (đơn vị vận hành gateway này). Gateway giữ secret đó server-side và ký request bằng MD5 theo chuẩn PVI.
- Các đối tác cấp 2 (AZP…) **không có credential với PVI Core**. Họ xác thực với gateway qua HMAC-SHA256 (xem [docs/partner-auth-plan.md](partner-auth-plan.md)) → gateway translate sang MD5 và gọi PVI Core.
- Mỗi đối tác có bản ghi trong bảng `Partner` + nhiều `PartnerSecret` (hỗ trợ rotate).
- Mỗi giao dịch lưu trong `Transaction` (gắn `partnerId`) và mọi call ngoài/vào lưu trong `ApiCallLog`.

Stack: NestJS 11 + Prisma 7 + PostgreSQL + Redis (rate limit, nonce store) + Swagger/Scalar docs ở `/docs`.

## 2. Vấn đề cần giải quyết

Hiện tại `AdminController` (file [src/admin/admin.controller.ts](../src/admin/admin.controller.ts)) trộn hai nhóm chức năng khác nhau và **chỉ có 1 endpoint duy nhất là có guard** — các endpoint còn lại đang **public hoàn toàn**:

| Endpoint hiện tại | Guard hiện tại | Vấn đề |
|---|---|---|
| `POST /admin/partners` | ❌ none | Bất kỳ ai cũng tạo được partner |
| `GET /admin/partners` | ❌ none | Lộ danh sách partner |
| `POST /admin/partners/:id/rotate-secret` | ❌ none | Bất kỳ ai cũng rotate được |
| `PATCH /admin/partners/:id/status` | ❌ none | Bất kỳ ai cũng bật/tắt partner |
| `GET /admin/transactions` | ✅ PartnerAuthGuard | OK nhưng đặt sai chỗ — đây là tài nguyên của partner, không phải admin |
| `GET /admin/transactions/:id` | ❌ none | Lộ giao dịch của mọi partner |
| `POST /admin/transactions/:id/reconcile` | ❌ none | Bất kỳ ai cũng trigger được |
| `GET /admin/api-logs` | ❌ none | Lộ toàn bộ request/response log |

**Mục tiêu** (để lên UAT nhanh, không over-engineer):

1. **Tách giao dịch ra `/transaction`** — partner tự xem giao dịch của mình bằng HMAC credential đã có.
2. **`/admin/*` chỉ còn quản lý partner + xem api-logs**, bảo vệ bằng **Bearer JWT** (admin login → JWT).
3. **Tạo bảng `Admin`** đơn giản nhất (username + passwordHash).
4. **Bootstrap seed 1 admin** từ env `ADMIN_USERNAME` / `ADMIN_PASSWORD` khi DB rỗng.

Không làm lần này: refresh token, đổi password, list/quản lý nhiều admin, audit log hành động admin, MFA.

## 3. Quyết định kiến trúc

| Lựa chọn | Đã chốt | Ghi chú |
|---|---|---|
| `/transaction/*` phục vụ ai | **Chỉ partner** (PartnerAuthGuard) | Admin nếu cần xem đối soát thì query DB trực tiếp; thêm endpoint admin sau khi có nhu cầu thật |
| Cơ chế admin auth | **JWT** ký bằng HMAC-SHA256 (lib `jsonwebtoken`) | Không revoke ngay được trong phạm vi token còn hạn — chấp nhận cho UAT, expiry ngắn (12h) |
| Hash password | **bcrypt** (cost 10) | Sẵn có, không cần native binding như argon2 |
| Seed admin | **Bootstrap-time** (`onModuleInit`) đọc env, insert nếu bảng rỗng | Idempotent qua mọi lần restart; không seed lại nếu đã có bất kỳ admin nào trong bảng |
| Login endpoint | `POST /admin/auth/login` (không guard) | Trả `{ token, expiresIn }` |

## 4. Database changes

### 4.1 Thêm model `Admin` vào [prisma/schema.prisma](../prisma/schema.prisma)

```prisma
model Admin {
  id           String   @id @default(uuid())
  username     String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}
```

Chỉ vậy. Không thêm `role`, `email`, `isActive`… UAT chưa cần.

### 4.2 Migration

Tạo `prisma/migrations/<timestamp>_add_admin/migration.sql`:

```sql
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");
```

Cách sinh: `pnpm prisma migrate dev --name add_admin` (hoặc tạo tay file SQL trên).

**Lưu ý:** migration **không seed data**. Seeding ban đầu chạy ở bootstrap (mục 6.3) vì password phải hash bằng bcrypt — không thể nhúng plain trong SQL file.

## 5. Env vars mới

### 5.1 Schema trong [src/config/env.ts](../src/config/env.ts)

Thêm vào `envSchema`:

```ts
ADMIN_JWT_SECRET: z.string().min(32),
ADMIN_JWT_EXPIRES_IN: z.string().default('12h'),
ADMIN_USERNAME: z.string().min(1).optional(),
ADMIN_PASSWORD: z.string().min(8).optional(),
```

- `ADMIN_JWT_SECRET` bắt buộc — sinh bằng `openssl rand -hex 32`.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` **optional**: nếu thiếu thì bootstrap skip seeding với log warning. Cho phép môi trường prod không tự seed bằng env (sẽ seed thủ công sau).

### 5.2 Thêm vào [.env.example](../.env.example)

```env
ADMIN_JWT_SECRET=
ADMIN_JWT_EXPIRES_IN=12h
ADMIN_USERNAME=admin
ADMIN_PASSWORD=
```

## 6. Module mới: `src/admin-auth/`

### 6.1 Cấu trúc file

```
src/admin-auth/
├── admin-auth.module.ts
├── admin.service.ts          # CRUD + bcrypt verify + seed
├── jwt.service.ts            # sign / verify JWT
├── admin-auth.guard.ts       # Bearer JWT guard
└── dto/
    ├── login.dto.ts
    └── login-result.dto.ts
```

### 6.2 `admin.service.ts`

```ts
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
      this.logger.warn('ADMIN_USERNAME / ADMIN_PASSWORD not set — skipping admin seed');
      return;
    }
    const count = await this.prisma.admin.count();
    if (count > 0) return; // idempotent — không seed lại nếu đã có admin

    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
    await this.prisma.admin.create({
      data: { username: env.ADMIN_USERNAME, passwordHash },
    });
    this.logger.log(`Seeded initial admin: ${env.ADMIN_USERNAME}`);
  }
}
```

### 6.3 `jwt.service.ts`

Dùng `jsonwebtoken` trực tiếp — không cần `@nestjs/jwt` (giảm dependency, scope nhỏ).

```ts
import * as jwt from 'jsonwebtoken';

export interface AdminTokenPayload {
  adminId: string;
  username: string;
}

@Injectable()
export class AdminJwtService {
  sign(payload: AdminTokenPayload): { token: string; expiresIn: string } {
    const env = getEnv();
    const token = jwt.sign(payload, env.ADMIN_JWT_SECRET, {
      expiresIn: env.ADMIN_JWT_EXPIRES_IN,
      algorithm: 'HS256',
    });
    return { token, expiresIn: env.ADMIN_JWT_EXPIRES_IN };
  }

  verify(token: string): AdminTokenPayload {
    const env = getEnv();
    return jwt.verify(token, env.ADMIN_JWT_SECRET, {
      algorithms: ['HS256'],
    }) as AdminTokenPayload;
  }
}
```

### 6.4 `admin-auth.guard.ts`

```ts
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
      (req as any).admin = { id: payload.adminId, username: payload.username };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
```

### 6.5 DTOs

`dto/login.dto.ts`:
```ts
export class LoginDto {
  @ApiProperty() @IsString() @IsNotEmpty() username!: string;
  @ApiProperty() @IsString() @IsNotEmpty() password!: string;
}
```

`dto/login-result.dto.ts`:
```ts
export class LoginResultDto {
  @ApiProperty() token!: string;
  @ApiProperty() expiresIn!: string;
}
```

### 6.6 `admin-auth.module.ts`

```ts
@Module({
  imports: [PrismaModule],
  providers: [AdminService, AdminJwtService, AdminAuthGuard],
  exports: [AdminService, AdminJwtService, AdminAuthGuard],
})
export class AdminAuthModule {}
```

## 7. Module mới: `src/transaction/`

### 7.1 Cấu trúc file

```
src/transaction/
├── transaction.module.ts
└── transaction.controller.ts
```

### 7.2 `transaction.controller.ts`

Logic copy/paste từ 3 endpoint hiện ở [src/admin/admin.controller.ts](../src/admin/admin.controller.ts) (`listTransactions`, `getTransaction`, `triggerReconcile`), với thay đổi:

- Toàn bộ endpoint áp `@UseGuards(PartnerAuthGuard)` + `@ApiPartnerAuth()`.
- `req.partner.id` lấy từ guard (đã gắn sẵn).
- **Mới**: kiểm tra ownership cho `GET /:id` và `POST /:id/reconcile` — nếu `tx.partnerId !== req.partner.id` thì throw `NotFoundException` (không trả 403 để tránh leak existence).

```ts
@ApiTags('transaction')
@ApiPartnerAuth()
@UseGuards(PartnerAuthGuard)
@Controller('transaction')
export class TransactionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconcile: ReconcileService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách giao dịch của partner' })
  list(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('policyNumber') policyNumber?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const partnerId = (req as any).partner.id as string;
    return this.prisma.transaction.findMany({
      where: {
        partnerId,
        ...(status ? { status: status as TxStatus } : {}),
        ...(policyNumber ? { policyNumber } : {}),
        ...(from || to ? { createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết giao dịch' })
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const partnerId = (req as any).partner.id as string;
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx || tx.partnerId !== partnerId) throw new NotFoundException();
    const logs = await this.prisma.apiCallLog.findMany({
      where: { maGiaodich: tx.maGiaodich },
      orderBy: { createdAt: 'asc' },
    });
    return { ...tx, apiCallLogs: logs };
  }

  @Post(':id/reconcile')
  @ApiOperation({ summary: 'Trigger đối soát giao dịch' })
  async reconcileOne(@Req() req: Request, @Param('id') id: string) {
    const partnerId = (req as any).partner.id as string;
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx || tx.partnerId !== partnerId) throw new NotFoundException();
    return this.reconcile.reconcileOne(tx.maGiaodich);
  }
}
```

### 7.3 `transaction.module.ts`

```ts
@Module({
  imports: [PrismaModule, PartnerAuthModule, ReconcileModule],
  controllers: [TransactionController],
})
export class TransactionModule {}
```

## 8. Refactor `src/admin/`

### 8.1 `admin.controller.ts` sau khi sửa

Giữ **chỉ** các endpoint quản lý partner + api-logs + login. **Mọi endpoint trừ `/auth/login` đều có `AdminAuthGuard`.**

```ts
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
    const ok = await this.adminService.verifyPassword(body.password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.adminJwt.sign({ adminId: admin.id, username: admin.username });
  }

  @Post('partners')
  @ApiAdminAuth()
  // ... y nguyên logic cũ
  createPartner(@Body() body: CreatePartnerDto) { /* ... */ }

  @Get('partners')
  @ApiAdminAuth()
  listPartners() { /* ... */ }

  @Post('partners/:id/rotate-secret')
  @ApiAdminAuth()
  rotatePartnerSecret(/* ... */) { /* ... */ }

  @Patch('partners/:id/status')
  @ApiAdminAuth()
  updatePartnerStatus(/* ... */) { /* ... */ }

  @Get('api-logs')
  @ApiAdminAuth()
  listApiLogs(/* ... */) { /* ... */ }
}
```

**Xóa** khỏi controller:
- `listTransactions`
- `getTransaction`
- `triggerReconcile`

### 8.2 `admin.module.ts`

```ts
@Module({
  imports: [PrismaModule, PartnerAuthModule, AdminAuthModule],
  controllers: [AdminController],
})
export class AdminModule {}
```

Xóa import `ReconcileModule` ở đây (đã chuyển sang `TransactionModule`).

## 9. Decorator `@ApiAdminAuth()`

File mới `src/common/decorators/api-admin-auth.decorator.ts` — combine Swagger doc + guard:

```ts
export function ApiAdminAuth() {
  return applyDecorators(
    UseGuards(AdminAuthGuard),
    ApiBearerAuth('admin-jwt'),
    ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' }),
  );
}
```

Tham khảo decorator tương đương cho partner: [src/common/decorators/api-partner-auth.decorator.ts](../src/common/decorators/api-partner-auth.decorator.ts).

## 10. Cập nhật Swagger trong [src/main.ts](../src/main.ts)

Thêm vào `DocumentBuilder`:

```ts
.addBearerAuth(
  { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  'admin-jwt',
)
```

Thêm tag `transaction`:
```ts
.addTag('transaction', 'Tra cứu & đối soát giao dịch (partner)')
```

## 11. Wire trong [src/app.module.ts](../src/app.module.ts)

Thêm `AdminAuthModule` và `TransactionModule` vào `imports`. `AdminModule` đã có sẵn, chỉ cần đảm bảo nó import `AdminAuthModule`.

## 12. Dependencies

Chạy:
```bash
pnpm add bcrypt jsonwebtoken
pnpm add -D @types/bcrypt @types/jsonwebtoken
```

## 13. Thứ tự implement (đề xuất cho Sonnet)

1. **Schema + migration**: sửa `prisma/schema.prisma`, chạy `pnpm prisma migrate dev --name add_admin`, `pnpm prisma generate`.
2. **Env**: cập nhật `src/config/env.ts` + `.env.example`. Set value tạm trong `.env` cho UAT.
3. **Dependencies**: `pnpm add` 2 package + types.
4. **Module `admin-auth`**: tạo 6 file theo mục 6.
5. **Decorator `@ApiAdminAuth`**: theo mục 9.
6. **Module `transaction`**: tạo theo mục 7.
7. **Refactor `admin`**: theo mục 8 — xóa 3 endpoint giao dịch, thêm login, gắn guard cho phần còn lại.
8. **Wire**: cập nhật `app.module.ts` + `main.ts` swagger.
9. **Build + start**: `pnpm build && pnpm start:dev`. Verify log có dòng `Seeded initial admin: <username>`.
10. **Smoke test** theo mục 14.

## 14. Acceptance test

Sau khi implement, chạy thủ công bằng curl hoặc Scalar:

| # | Test | Kỳ vọng |
|---|---|---|
| 1 | `POST /admin/auth/login` với `{username, password}` đúng | 200, trả `{ token, expiresIn }` |
| 2 | `POST /admin/auth/login` với password sai | 401 `Invalid credentials` |
| 3 | `GET /admin/partners` không Bearer | 401 `Missing bearer token` |
| 4 | `GET /admin/partners` với token hết hạn | 401 `Invalid or expired token` |
| 5 | `GET /admin/partners` với Bearer hợp lệ | 200, list partner |
| 6 | `POST /admin/partners` với Bearer hợp lệ | 200, tạo partner |
| 7 | `GET /admin/api-logs` với Bearer hợp lệ | 200 |
| 8 | `GET /transaction` với HMAC partner A hợp lệ | 200, chỉ thấy tx của A |
| 9 | `GET /transaction/<id-thuộc-B>` với HMAC partner A | 404 |
| 10 | `POST /transaction/<id-thuộc-B>/reconcile` với HMAC partner A | 404 |
| 11 | `GET /transaction/<id-của-A>` với HMAC partner A | 200, có `apiCallLogs` |
| 12 | Endpoint cũ `GET /admin/transactions` | 404 (đã xóa) |
| 13 | Restart app với DB rỗng, env đầy đủ | log `Seeded initial admin: …` |
| 14 | Restart lần 2 | không seed lại, không log seeded |
| 15 | Start app không có `ADMIN_JWT_SECRET` | crash với lỗi env validation |

## 15. Files bị đụng tới

**Tạo mới:**
- `prisma/migrations/<ts>_add_admin/migration.sql`
- `src/admin-auth/admin-auth.module.ts`
- `src/admin-auth/admin.service.ts`
- `src/admin-auth/jwt.service.ts`
- `src/admin-auth/admin-auth.guard.ts`
- `src/admin-auth/dto/login.dto.ts`
- `src/admin-auth/dto/login-result.dto.ts`
- `src/transaction/transaction.module.ts`
- `src/transaction/transaction.controller.ts`
- `src/common/decorators/api-admin-auth.decorator.ts`

**Sửa:**
- `prisma/schema.prisma` — thêm model `Admin`
- `src/config/env.ts` — thêm 4 env vars
- `.env.example` — thêm 4 env vars
- `src/admin/admin.controller.ts` — xóa 3 endpoint transaction, thêm `/auth/login`, gắn guard
- `src/admin/admin.module.ts` — bỏ `ReconcileModule`, thêm `AdminAuthModule`
- `src/app.module.ts` — thêm 2 module mới
- `src/main.ts` — thêm bearer auth scheme + tag swagger
- `package.json` — 2 deps + 2 dev deps

## 16. Out of scope (làm sau)

- Quản lý nhiều admin (CRUD admin qua API)
- Đổi password
- Refresh token / revoke token
- Audit log hành động admin
- MFA
- Tắt `/dev/signer` ở production (theo dõi riêng — `DevController` hiện luôn được mount, cần guard NODE_ENV trước go-live)
- Endpoint admin để xem mọi giao dịch (cross-partner) — chỉ thêm khi có nhu cầu vận hành thật

---

**Ngữ cảnh dự án:**
- PVI Core API doc: theo file `API_Document_South-AZ_Plus.pdf` ở root repo
- Yêu cầu hạ tầng: file `Bieu mau yc cap ha tang - v01 PVI.pdf` ở root repo
- Partner HMAC scheme: [docs/partner-auth-plan.md](partner-auth-plan.md)
- Kiến trúc tổng: [docs/architecture.md](architecture.md)
- Flow nghiệp vụ: [docs/motor-insurance-flow.md](motor-insurance-flow.md)
