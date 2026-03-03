import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramService } from '../telegram/telegram.service';
import { KeysService } from '../keys/keys.service';
import { BucketsService } from '../buckets/buckets.service';
import { ObjectsService } from '../objects/objects.service';
import { S3Controller } from './s3.controller';
import { S3BucketService } from './s3-bucket.service';
import { S3ObjectService } from './s3-object.service';
import { S3MultipartService } from './s3-multipart.service';
import { S3AuthGuard } from '../../common/guards/s3-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '..', '.env'),
        join(__dirname, '..', '..', '..', '..', '.env'),
      ],
    }),
    PrismaModule,
  ],
  controllers: [S3Controller],
  providers: [
    TelegramService,
    KeysService,
    BucketsService,
    ObjectsService,
    S3BucketService,
    S3ObjectService,
    S3MultipartService,
    S3AuthGuard,
  ],
})
export class S3AppModule {}
