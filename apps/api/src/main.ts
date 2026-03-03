import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { S3AppModule } from './modules/s3/s3-app.module';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';

/**
 * Decode AWS chunked transfer encoding body.
 * Format: <hex-size>;chunk-signature=<sig>\r\n<data>\r\n...0;chunk-signature=<sig>\r\n\r\n
 */
function decodeAwsChunked(buffer: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    const headerEnd = buffer.indexOf('\r\n', offset);
    if (headerEnd === -1) break;

    const header = buffer.subarray(offset, headerEnd).toString('ascii');
    const semiIndex = header.indexOf(';');
    const sizeHex = (semiIndex >= 0 ? header.slice(0, semiIndex) : header).trim();
    const chunkSize = parseInt(sizeHex, 16);

    if (chunkSize === 0) break;

    const dataStart = headerEnd + 2;
    if (dataStart + chunkSize > buffer.length) break;
    chunks.push(buffer.subarray(dataStart, dataStart + chunkSize));

    offset = dataStart + chunkSize + 2;
  }

  return Buffer.concat(chunks);
}

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
  // Handle AWS chunked transfer encoding before body parsing
  s3App.use((req: any, _res: any, next: any) => {
    const encoding = req.headers['content-encoding'];
    if (encoding && encoding.includes('aws-chunked')) {
      req._isAwsChunked = true;
      delete req.headers['content-encoding'];
    }
    next();
  });
  // Use raw body parser for all S3 routes.
  // type function returns true to parse even when Content-Type header is missing
  // (AWS CLI omits it for s3api put-object).
  s3App.use(
    express.raw({
      type: () => true,
      limit: '2gb',
    }),
  );
  // Decode AWS chunked body after raw parsing
  s3App.use((req: any, _res: any, next: any) => {
    if (req._isAwsChunked && Buffer.isBuffer(req.body) && req.body.length > 0) {
      req.body = decodeAwsChunked(req.body);
    }
    next();
  });
  const s3Port = configService.get<number>('S3_API_PORT', 4000);
  await s3App.listen(s3Port);
  console.log(`S3 API running on http://localhost:${s3Port}`);
}

bootstrap();
