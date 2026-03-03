import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BucketsService } from '../buckets/buckets.service';
import { ObjectsService } from '../objects/objects.service';
import { S3Exception } from '../../common/guards/s3-exception';
import {
  buildListBucketsXml,
  buildListObjectsV2Xml,
} from '../../common/utils/xml-builder';

@Injectable()
export class S3BucketService {
  constructor(
    private prisma: PrismaService,
    private bucketsService: BucketsService,
    private objectsService: ObjectsService,
  ) {}

  async listBuckets(): Promise<string> {
    const buckets = await this.prisma.bucket.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return buildListBucketsXml(
      buckets.map((b) => ({ name: b.name, createdAt: b.createdAt })),
    );
  }

  async createBucket(name: string): Promise<void> {
    try {
      await this.bucketsService.create(name);
    } catch (error: any) {
      if (error.status === 409) {
        throw new S3Exception('BucketAlreadyExists', `/${name}`);
      }
      if (error.status === 400) {
        throw new S3Exception('InvalidBucketName', `/${name}`);
      }
      throw error;
    }
  }

  async deleteBucket(name: string): Promise<void> {
    try {
      await this.bucketsService.delete(name);
    } catch (error: any) {
      if (error.status === 404) {
        throw new S3Exception('NoSuchBucket', `/${name}`);
      }
      if (error.status === 409) {
        throw new S3Exception('BucketNotEmpty', `/${name}`);
      }
      throw error;
    }
  }

  async headBucket(name: string): Promise<void> {
    const bucket = await this.bucketsService.findByName(name);
    if (!bucket) {
      throw new S3Exception('NoSuchBucket', `/${name}`);
    }
  }

  async listObjectsV2(
    bucketName: string,
    prefix: string,
    delimiter: string,
    maxKeys: number,
    continuationToken?: string,
  ): Promise<string> {
    const bucket = await this.bucketsService.findByName(bucketName);
    if (!bucket) {
      throw new S3Exception('NoSuchBucket', `/${bucketName}`);
    }

    const result = await this.objectsService.listObjects(
      bucketName,
      prefix,
      delimiter,
      maxKeys,
      continuationToken,
    );

    return buildListObjectsV2Xml({
      bucketName,
      prefix,
      delimiter,
      maxKeys,
      keyCount: result.keyCount,
      isTruncated: result.isTruncated,
      nextContinuationToken: result.nextContinuationToken,
      contents: result.contents.map((obj) => ({
        key: obj.key,
        lastModified: new Date(obj.lastModified),
        etag: obj.etag,
        size: BigInt(obj.size),
        storageClass: 'STANDARD',
      })),
      commonPrefixes: result.folders.map((f) => f.prefix),
    });
  }
}
