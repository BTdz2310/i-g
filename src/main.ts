import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiReferenceOptions } from '@scalar/nestjs-api-reference';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { validateEnv } from './config/env';
import { RawBodyRequest } from './common/types/raw-body';

async function bootstrap() {
  validateEnv(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // Tin tưởng X-Forwarded-* từ reverse proxy (Nginx/ALB) đứng trước app.
  // Cần thiết để req.ip trả IP thật của client cho IP allowlist của partner.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

  // Security headers: HSTS, X-Frame-Options, X-Content-Type-Options, etc.
  // CSP tắt vì Scalar (/docs) cần inline scripts.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.use(
    json({
      verify: (req, _res, buf) => {
        (req as RawBodyRequest).rawBody = buf;
      },
    }),
  );
  app.use(
    urlencoded({
      extended: true,
      verify: (req, _res, buf) => {
        (req as RawBodyRequest).rawBody = buf;
      },
    }),
  );

  const builder = new DocumentBuilder()
    .setTitle('Insurance Gateway')
    .setDescription(
      'BFF gateway kết nối PVI Insurance — giấu credential, sign server-side, log giao dịch, nhận callback.',
    )
    .setVersion('1.0')
    .addTag('catalog', 'Danh mục PVI (loại xe, hãng xe, mục đích sử dụng...)')
    .addTag('quote', 'Tính phí bảo hiểm TNDS')
    .addTag('order', 'Tạo đơn & tra cứu đơn bảo hiểm')
    .addTag('callback', 'Webhook từ PVI khi đơn được cấp')
    .addTag('transaction', 'Tra cứu & đối soát giao dịch (partner)')
    .addTag('quote-moto', 'Tính phí TNDS xe máy')
    .addTag('order-moto', 'Tạo & tra cứu đơn TNDS xe máy')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'admin-jwt',
    );

  const swaggerConfig = builder.build();

  // Lắng nghe SIGTERM/SIGINT để NestJS chạy onModuleDestroy (đóng Redis,
  // Prisma) trước khi tắt — tránh cắt request khi node bị thay trong HA.
  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  const scalarOptions: ApiReferenceOptions = {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    spec: { content: document } as any,
    configuration: {
      theme: 'purple',
      layout: 'sidebar',
      defaultHttpClient: { targetKey: 'javascript', clientKey: 'fetch' },
    },
  };

  const { apiReference } = await import('@scalar/nestjs-api-reference');
  app.use('/docs', apiReference(scalarOptions));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`Docs: http://localhost:${port}/docs`, 'Bootstrap');

  // Signal PM2 rằng app đã sẵn sàng nhận traffic (dùng với wait_ready: true)
  if (process.send) process.send('ready');
}
bootstrap();
