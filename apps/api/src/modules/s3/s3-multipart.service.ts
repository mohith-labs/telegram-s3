import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { S3Exception } from '../../common/guards/s3-exception';
import { computeEtag, computeMultipartEtag } from '../../common/utils/etag';
import {
  buildInitiateMultipartUploadXml,
  buildCompleteMultipartUploadXml,
  buildListPartsXml,
} from '../../common/utils/xml-builder';

@Injectable()
export class S3MultipartService {
  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  async initiate(
    bucketName: string,
    key: string,
    contentType: string,
    metadata: Record<string, string>,
  ): Promise<string> {
    const bucket = await this.prisma.bucket.findUnique({
      where: { name: bucketName },
    });
    if (!bucket) throw new S3Exception('NoSuchBucket', `/${bucketName}`);

    const upload = await this.prisma.multipartUpload.create({
      data: {
        bucketId: bucket.id,
        key,
        contentType,
        metadata: JSON.stringify(metadata),
      },
    });

    return buildInitiateMultipartUploadXml(bucketName, key, upload.id);
  }

  async uploadPart(
    bucketName: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<string> {
    const upload = await this.prisma.multipartUpload.findUnique({
      where: { id: uploadId },
      include: { bucket: true },
    });
    if (!upload) throw new S3Exception('NoSuchUpload', `/${bucketName}`);

    const etag = computeEtag(body);

    // Upload part to Telegram
    const { messageId } = await this.telegram.uploadFile(
      upload.bucket.channelId,
      upload.bucket.channelAccessHash,
      body,
      `${uploadId}_part_${partNumber}`,
      'application/octet-stream',
    );

    // Upsert part record
    await this.prisma.multipartPart.upsert({
      where: {
        uploadId_partNumber: { uploadId, partNumber },
      },
      create: {
        uploadId,
        partNumber,
        messageId,
        size: BigInt(body.length),
        etag,
      },
      update: {
        messageId,
        size: BigInt(body.length),
        etag,
      },
    });

    return etag;
  }

  async complete(
    bucketName: string,
    key: string,
    uploadId: string,
    xmlBody: Buffer,
  ): Promise<string> {
    const upload = await this.prisma.multipartUpload.findUnique({
      where: { id: uploadId },
      include: { bucket: true, parts: { orderBy: { partNumber: 'asc' } } },
    });
    if (!upload) throw new S3Exception('NoSuchUpload', `/${bucketName}`);

    // Parse the completion XML (simple extraction)
    const bodyStr = xmlBody.toString();
    const partMatches = bodyStr.matchAll(
      /<Part>\s*<PartNumber>(\d+)<\/PartNumber>\s*<ETag>"?([^"<]+)"?<\/ETag>\s*<\/Part>/g,
    );

    const requestedParts: { partNumber: number; etag: string }[] = [];
    for (const match of partMatches) {
      requestedParts.push({
        partNumber: parseInt(match[1]),
        etag: match[2],
      });
    }

    // Validate parts
    if (requestedParts.length === 0) {
      throw new S3Exception('MalformedXML', `/${bucketName}/${key}`);
    }

    // Verify parts exist and ETags match
    for (const rp of requestedParts) {
      const dbPart = upload.parts.find((p) => p.partNumber === rp.partNumber);
      if (!dbPart) {
        throw new S3Exception('InvalidPart', `/${bucketName}/${key}`);
      }
      if (dbPart.etag !== rp.etag) {
        throw new S3Exception('InvalidPart', `/${bucketName}/${key}`);
      }
    }

    // Verify ascending order
    for (let i = 1; i < requestedParts.length; i++) {
      if (requestedParts[i].partNumber <= requestedParts[i - 1].partNumber) {
        throw new S3Exception('InvalidPartOrder', `/${bucketName}/${key}`);
      }
    }

    // Calculate combined ETag
    const partEtags = requestedParts.map((rp) => rp.etag);
    const combinedEtag = computeMultipartEtag(partEtags);

    // Calculate total size
    const totalSize = upload.parts.reduce(
      (sum, p) => sum + p.size,
      BigInt(0),
    );

    // Delete existing object if it exists
    const existingObj = await this.prisma.s3Object.findUnique({
      where: {
        bucketId_key: { bucketId: upload.bucketId, key: upload.key },
      },
      include: { chunks: true },
    });

    if (existingObj) {
      if (existingObj.chunks.length > 0) {
        try {
          await this.telegram.deleteMessages(
            upload.bucket.channelId,
            upload.bucket.channelAccessHash,
            existingObj.chunks.map((c) => c.messageId),
          );
        } catch {}
      }
      await this.prisma.s3Object.delete({ where: { id: existingObj.id } });
    }

    // Create the S3Object with chunks from the multipart parts
    const s3Object = await this.prisma.s3Object.create({
      data: {
        key: upload.key,
        bucketId: upload.bucketId,
        size: totalSize,
        contentType: upload.contentType,
        etag: combinedEtag,
        metadata: upload.metadata,
        chunks: {
          create: requestedParts.map((rp, index) => {
            const dbPart = upload.parts.find(
              (p) => p.partNumber === rp.partNumber,
            )!;
            return {
              chunkIndex: index,
              messageId: dbPart.messageId,
              fileSize: dbPart.size,
            };
          }),
        },
      },
    });

    // Clean up multipart upload records
    await this.prisma.multipartUpload.delete({ where: { id: uploadId } });

    return buildCompleteMultipartUploadXml(bucketName, key, combinedEtag);
  }

  async abort(bucketName: string, uploadId: string): Promise<void> {
    const upload = await this.prisma.multipartUpload.findUnique({
      where: { id: uploadId },
      include: { bucket: true, parts: true },
    });
    if (!upload) throw new S3Exception('NoSuchUpload', `/${bucketName}`);

    // Delete Telegram messages
    if (upload.parts.length > 0) {
      try {
        await this.telegram.deleteMessages(
          upload.bucket.channelId,
          upload.bucket.channelAccessHash,
          upload.parts.map((p) => p.messageId),
        );
      } catch {}
    }

    // Delete records
    await this.prisma.multipartUpload.delete({ where: { id: uploadId } });
  }

  async listParts(
    bucketName: string,
    key: string,
    uploadId: string,
  ): Promise<string> {
    const upload = await this.prisma.multipartUpload.findUnique({
      where: { id: uploadId },
      include: { parts: { orderBy: { partNumber: 'asc' } } },
    });
    if (!upload) throw new S3Exception('NoSuchUpload', `/${bucketName}`);

    return buildListPartsXml({
      bucket: bucketName,
      key,
      uploadId,
      parts: upload.parts.map((p) => ({
        partNumber: p.partNumber,
        etag: p.etag,
        size: p.size,
        lastModified: new Date(),
      })),
    });
  }
}
