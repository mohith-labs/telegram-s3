import { Injectable } from '@nestjs/common';
import { ObjectsService } from '../objects/objects.service';
import { S3Exception } from '../../common/guards/s3-exception';
import { buildCopyObjectResultXml } from '../../common/utils/xml-builder';

@Injectable()
export class S3ObjectService {
  constructor(private objectsService: ObjectsService) {}

  async putObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string,
    metadata: Record<string, string>,
  ) {
    try {
      return await this.objectsService.putObject(
        bucket,
        key,
        body,
        contentType,
        metadata,
      );
    } catch (error: any) {
      if (error.status === 404) {
        throw new S3Exception('NoSuchBucket', `/${bucket}/${key}`);
      }
      throw error;
    }
  }

  async getObject(bucket: string, key: string) {
    try {
      return await this.objectsService.getObject(bucket, key);
    } catch (error: any) {
      if (error.message === 'Object not found') {
        throw new S3Exception('NoSuchKey', `/${bucket}/${key}`);
      }
      if (error.message === 'Bucket not found') {
        throw new S3Exception('NoSuchBucket', `/${bucket}`);
      }
      throw error;
    }
  }

  async getObjectStream(bucket: string, key: string) {
    try {
      return await this.objectsService.getObjectStream(bucket, key);
    } catch (error: any) {
      if (error.message === 'Object not found') {
        throw new S3Exception('NoSuchKey', `/${bucket}/${key}`);
      }
      if (error.message === 'Bucket not found') {
        throw new S3Exception('NoSuchBucket', `/${bucket}`);
      }
      throw error;
    }
  }

  async headObject(bucket: string, key: string) {
    try {
      return await this.objectsService.headObject(bucket, key);
    } catch (error: any) {
      if (error.status === 404) {
        throw new S3Exception('NoSuchKey', `/${bucket}/${key}`);
      }
      throw error;
    }
  }

  async deleteObject(bucket: string, key: string) {
    try {
      return await this.objectsService.deleteObject(bucket, key);
    } catch (error: any) {
      if (error.status === 404 && error.message?.includes('Bucket')) {
        throw new S3Exception('NoSuchBucket', `/${bucket}`);
      }
      throw error;
    }
  }

  async copyObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ) {
    try {
      return await this.objectsService.copyObject(
        sourceBucket,
        sourceKey,
        destBucket,
        destKey,
      );
    } catch (error: any) {
      if (error.status === 404) {
        throw new S3Exception('NoSuchKey', `/${sourceBucket}/${sourceKey}`);
      }
      throw error;
    }
  }

  buildCopyResult(etag: string, lastModified: Date): string {
    return buildCopyObjectResultXml(etag, lastModified);
  }
}
