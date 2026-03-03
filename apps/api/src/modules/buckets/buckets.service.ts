import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class BucketsService {
  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  async list() {
    const buckets = await this.prisma.bucket.findMany({
      include: {
        _count: { select: { objects: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get total size per bucket
    const result = await Promise.all(
      buckets.map(async (bucket) => {
        const sizeResult = await this.prisma.s3Object.aggregate({
          where: { bucketId: bucket.id },
          _sum: { size: true },
        });
        return {
          id: bucket.id,
          name: bucket.name,
          channelId: bucket.channelId.toString(),
          objectCount: bucket._count.objects,
          totalSize: Number(sizeResult._sum.size || 0),
          createdAt: bucket.createdAt.toISOString(),
          updatedAt: bucket.updatedAt.toISOString(),
        };
      }),
    );

    return result;
  }

  async create(name: string) {
    // Validate bucket name (DNS-compatible)
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(name)) {
      throw new BadRequestException(
        'Bucket name must be 3-63 characters, lowercase, numbers, hyphens, and periods',
      );
    }

    // Check uniqueness
    const existing = await this.prisma.bucket.findUnique({
      where: { name },
    });
    if (existing) {
      throw new ConflictException('Bucket already exists');
    }

    // Create Telegram channel
    const { channelId, accessHash } = await this.telegram.createChannel(name);

    // Save to DB
    const bucket = await this.prisma.bucket.create({
      data: {
        name,
        channelId,
        channelAccessHash: accessHash,
      },
    });

    return {
      id: bucket.id,
      name: bucket.name,
      channelId: bucket.channelId.toString(),
      createdAt: bucket.createdAt.toISOString(),
    };
  }

  async delete(name: string) {
    const bucket = await this.prisma.bucket.findUnique({
      where: { name },
      include: { _count: { select: { objects: true } } },
    });

    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    if (bucket._count.objects > 0) {
      throw new ConflictException('Bucket is not empty');
    }

    // Delete Telegram channel
    try {
      await this.telegram.deleteChannel(
        bucket.channelId,
        bucket.channelAccessHash,
      );
    } catch (error) {
      // Channel might already be deleted
    }

    // Delete from DB
    await this.prisma.bucket.delete({ where: { id: bucket.id } });

    return { deleted: true };
  }

  async findByName(name: string) {
    return this.prisma.bucket.findUnique({ where: { name } });
  }
}
