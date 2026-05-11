import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiReferenceOptions } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';
import { validateEnv } from './config/env';

async function bootstrap() {
  validateEnv(process.env as Record<string, unknown>);
  const app = await NestFactory.create(AppModule);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Insurance Gateway')
    .setDescription('BFF gateway kết nối PVI Insurance — giấu credential, sign server-side, log giao dịch, nhận callback.')
    .setVersion('1.0')
    .addTag('catalog', 'Danh mục PVI (loại xe, hãng xe, mục đích sử dụng...)')
    .addTag('quote', 'Tính phí bảo hiểm TNDS')
    .addTag('order', 'Tạo đơn & tra cứu đơn bảo hiểm')
    .addTag('callback', 'Webhook từ PVI khi đơn được cấp')
    .addTag('admin', 'Quản trị giao dịch & log')
    .build();

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  const scalarOptions: ApiReferenceOptions = {
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
  console.log(`Docs: http://localhost:${port}/docs`);

  // Signal PM2 rằng app đã sẵn sàng nhận traffic (dùng với wait_ready: true)
  if (process.send) process.send('ready');
}
bootstrap();
