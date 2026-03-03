import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { KeysModule } from './modules/keys/keys.module';
import { BucketsModule } from './modules/buckets/buckets.module';
import { ObjectsModule } from './modules/objects/objects.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '.env'),
        join(__dirname, '..', '..', '..', '.env'),
      ],
    }),
    PrismaModule,
    AdminModule,
    TelegramModule,
    KeysModule,
    BucketsModule,
    ObjectsModule,
  ],
})
export class AppModule {}
