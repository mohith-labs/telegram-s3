import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { S3AppModule } from './modules/s3/s3-app.module';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';

async function bootstrap() {
  // Admin API server
  const adminApp = await NestFactory.create(AppModule);
  adminApp.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  adminApp.enableCors({
    origin: true,
    credentials: true,
  });
  adminApp.setGlobalPrefix('api');

  const configService = adminApp.get(ConfigService);
  const adminPort = configService.get<number>('ADMIN_API_PORT', 3001);
  await adminApp.listen(adminPort);
  console.log(`Admin API running on http://localhost:${adminPort}`);

  // S3 API server
  const s3App = await NestFactory.create(S3AppModule, { bodyParser: false });
  // Use raw body parser for all S3 routes
  s3App.use(
    express.raw({
      type: '*/*',
      limit: '2gb',
    }),
  );
  const s3Port = configService.get<number>('S3_API_PORT', 4000);
  await s3App.listen(s3Port);
  console.log(`S3 API running on http://localhost:${s3Port}`);
}

bootstrap();
