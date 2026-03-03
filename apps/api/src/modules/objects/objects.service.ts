import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { computeEtag } from '../../common/utils/etag';
import { CHUNK_SIZE } from '@tgs3/shared';
import * as path from 'path';

@Injectable()
export class ObjectsService {
  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  async listObjects(
    bucketName: string,
    prefix: string = '',
    delimiter: string = '',
    maxKeys: number = 1000,
    continuationToken?: string,
  ) {
    const bucket = await this.prisma.bucket.findUnique({
      where: { name: bucketName },
    });
    if (!bucket) throw new NotFoundException('Bucket not found');

    const where: any = { bucketId: bucket.id };
    if (prefix) {
      where.key = { startsWith: prefix };
    }
    if (continuationToken) {
      where.id = { gt: continuationToken };
    }

    const objects = await this.prisma.s3Object.findMany({
      where,
      orderBy: { key: 'asc' },
      take: maxKeys + 1,
    });

    const isTruncated = objects.length > maxKeys;
    const items = objects.slice(0, maxKeys);

    // Handle delimiter for folder simulation
    const contents: any[] = [];
    const commonPrefixes = new Set<string>();

    if (delimiter) {
      for (const obj of items) {
        const keyAfterPrefix = obj.key.slice(prefix.length);
        const delimiterIndex = keyAfterPrefix.indexOf(delimiter);
        if (delimiterIndex >= 0) {
          commonPrefixes.add(prefix + keyAfterPrefix.slice(0, delimiterIndex + 1));
        } else {
          contents.push(obj);
        }
      }
    } else {
      contents.push(...items);
    }

    return {
      contents: contents.map((obj) => ({
        key: obj.key,
        size: Number(obj.size),
        contentType: obj.contentType,
        etag: obj.etag,
        lastModified: obj.updatedAt.toISOString(),
      })),
      folders: Array.from(commonPrefixes).map((p) => ({ prefix: p })),
      isTruncated,
      nextContinuationToken: isTruncated ? items[items.length - 1].id : undefined,
      keyCount: contents.length + commonPrefixes.size,
    };
  }

  async putObject(
    bucketName: string,
    key: string,
    body: Buffer,
    contentType: string,
    metadata: Record<string, string> = {},
  ) {
    const bucket = await this.prisma.bucket.findUnique({
      where: { name: bucketName },
    });
    if (!bucket) throw new NotFoundException('Bucket not found');

    const etag = computeEtag(body);
    const filename = path.basename(key) || key;

    // Delete existing object if it exists
    const existingObj = await this.prisma.s3Object.findUnique({
      where: { bucketId_key: { bucketId: bucket.id, key } },
      include: { chunks: true },
    });

    if (existingObj) {
      // Delete old Telegram messages
      if (existingObj.chunks.length > 0) {
        try {
          await this.telegram.deleteMessages(
            bucket.channelId,
            bucket.channelAccessHash,
            existingObj.chunks.map((c) => c.messageId),
          );
        } catch {}
      }
      await this.prisma.s3Object.delete({
        where: { id: existingObj.id },
      });
    }

    // Upload to Telegram (single chunk for now)
    const { messageId } = await this.telegram.uploadFile(
      bucket.channelId,
      bucket.channelAccessHash,
      body,
      filename,
      contentType,
    );

    // Create DB records
    const s3Object = await this.prisma.s3Object.create({
      data: {
        key,
        bucketId: bucket.id,
        size: BigInt(body.length),
        contentType,
        etag,
        metadata: JSON.stringify(metadata),
        chunks: {
          create: {
            chunkIndex: 0,
            messageId,
            fileSize: BigInt(body.length),
          },
        },
      },
    });

    return { etag, size: body.length };
  }

  async getObject(bucketName: string, key: string) {
    const bucket = await this.prisma.bucket.findUnique({
      where: { name: bucketName },
    });
    if (!bucket) throw new NotFoundException('Bucket not found');

    const obj = await this.prisma.s3Object.findUnique({
      where: { bucketId_key: { bucketId: bucket.id, key } },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
    });
    if (!obj) throw new NotFoundException('Object not found');

    // Download all chunks
    const buffers: Buffer[] = [];
    for (const chunk of obj.chunks) {
      const buf = await this.telegram.downloadFile(
        bucket.channelId,
        bucket.channelAccessHash,
        chunk.messageId,
      );
      buffers.push(buf);
    }

    return {
      body: Buffer.concat(buffers),
      contentType: obj.contentType,
      etag: obj.etag,
      size: Number(obj.size),
      lastModified: obj.updatedAt,
      metadata: JSON.parse(obj.metadata),
    };
  }

  async headObject(bucketName: string, key: string) {
    const bucket = await this.prisma.bucket.findUnique({
      where: { name: bucketName },
    });
    if (!bucket) throw new NotFoundException('Bucket not found');

    const obj = await this.prisma.s3Object.findUnique({
      where: { bucketId_key: { bucketId: bucket.id, key } },
    });
    if (!obj) throw new NotFoundException('Object not found');

    return {
      contentType: obj.contentType,
      etag: obj.etag,
      size: Number(obj.size),
      lastModified: obj.updatedAt,
      metadata: JSON.parse(obj.metadata),
    };
  }

  async deleteObject(bucketName: string, key: string) {
    const bucket = await this.prisma.bucket.findUnique({
      where: { name: bucketName },
    });
    if (!bucket) throw new NotFoundException('Bucket not found');

    const obj = await this.prisma.s3Object.findUnique({
      where: { bucketId_key: { bucketId: bucket.id, key } },
      include: { chunks: true },
    });
    if (!obj) return; // S3 delete is idempotent

    // Delete from Telegram
    if (obj.chunks.length > 0) {
      try {
        await this.telegram.deleteMessages(
          bucket.channelId,
          bucket.channelAccessHash,
          obj.chunks.map((c) => c.messageId),
        );
      } catch {}
    }

    // Delete from DB
    await this.prisma.s3Object.delete({ where: { id: obj.id } });
  }

  async copyObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ) {
    // Get source object
    const source = await this.getObject(sourceBucket, sourceKey);

    // Put to destination
    const result = await this.putObject(
      destBucket,
      destKey,
      source.body,
      source.contentType,
      source.metadata,
    );

    return {
      etag: result.etag,
      lastModified: new Date(),
    };
  }

  async getStats() {
    const totalBuckets = await this.prisma.bucket.count();
    const totalObjects = await this.prisma.s3Object.count();
    const sizeResult = await this.prisma.s3Object.aggregate({
      _sum: { size: true },
    });
    const totalSize = Number(sizeResult._sum.size || 0);

    return { totalBuckets, totalObjects, totalSize };
  }
}
