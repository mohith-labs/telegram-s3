import {
  All,
  Controller,
  Get,
  Req,
  Res,
  Param,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { S3AuthGuard } from '../../common/guards/s3-auth.guard';
import { S3ExceptionFilter } from '../../common/filters/s3-exception.filter';
import { S3BucketService } from './s3-bucket.service';
import { S3ObjectService } from './s3-object.service';
import { S3MultipartService } from './s3-multipart.service';
import { S3Exception } from '../../common/guards/s3-exception';
import { v4 as uuid } from 'uuid';

@Controller()
@UseFilters(S3ExceptionFilter)
@UseGuards(S3AuthGuard)
export class S3Controller {
  constructor(
    private bucketService: S3BucketService,
    private objectService: S3ObjectService,
    private multipartService: S3MultipartService,
  ) {}

  // GET / -> ListBuckets
  @Get()
  async listBuckets(@Res() res: Response) {
    const xml = await this.bucketService.listBuckets();
    this.sendXml(res, xml);
  }

  // Bucket-level operations
  @All(':bucket')
  async bucketOperation(
    @Param('bucket') bucket: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    switch (req.method) {
      case 'PUT':
        await this.bucketService.createBucket(bucket);
        res.status(200).header('Location', `/${bucket}`).send();
        break;

      case 'DELETE':
        await this.bucketService.deleteBucket(bucket);
        res.status(204).send();
        break;

      case 'HEAD':
        await this.bucketService.headBucket(bucket);
        res.status(200).send();
        break;

      case 'GET': {
        const prefix = (req.query['prefix'] as string) || '';
        const delimiter = (req.query['delimiter'] as string) || '';
        const maxKeys = parseInt((req.query['max-keys'] as string) || '1000');
        const continuationToken = req.query['continuation-token'] as string;

        const xml = await this.bucketService.listObjectsV2(
          bucket,
          prefix,
          delimiter,
          maxKeys,
          continuationToken,
        );
        this.sendXml(res, xml);
        break;
      }

      default:
        throw new S3Exception('InternalError', `/${bucket}`);
    }
  }

  // Object-level operations
  @All(':bucket/*key')
  async objectOperation(
    @Param('bucket') bucket: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Extract the full key from the URL path after /:bucket/
    const key = (req.params as any).key || (req.params as any)[0] || '';

    // Check for multipart operations
    if (req.method === 'POST' && 'uploads' in req.query) {
      return this.handleInitiateMultipart(bucket, key, req, res);
    }
    if (req.method === 'POST' && req.query['uploadId']) {
      return this.handleCompleteMultipart(bucket, key, req, res);
    }
    if (req.method === 'PUT' && req.query['partNumber'] && req.query['uploadId']) {
      return this.handleUploadPart(bucket, key, req, res);
    }
    if (req.method === 'DELETE' && req.query['uploadId']) {
      return this.handleAbortMultipart(bucket, key, req, res);
    }
    if (req.method === 'GET' && req.query['uploadId']) {
      return this.handleListParts(bucket, key, req, res);
    }

    switch (req.method) {
      case 'PUT': {
        // Check for CopyObject
        const copySource = req.headers['x-amz-copy-source'] as string;
        if (copySource) {
          return this.handleCopyObject(bucket, key, copySource, req, res);
        }
        return this.handlePutObject(bucket, key, req, res);
      }

      case 'GET':
        return this.handleGetObject(bucket, key, req, res);

      case 'HEAD':
        return this.handleHeadObject(bucket, key, req, res);

      case 'DELETE':
        return this.handleDeleteObject(bucket, key, req, res);

      default:
        throw new S3Exception('InternalError', `/${bucket}/${key}`);
    }
  }

  private async handlePutObject(
    bucket: string,
    key: string,
    req: Request,
    res: Response,
  ) {
    const body = (req as any).body as Buffer;
    const contentType =
      (req.headers['content-type'] as string) || 'application/octet-stream';

    // Extract x-amz-meta-* headers
    const metadata: Record<string, string> = {};
    for (const [header, value] of Object.entries(req.headers)) {
      if (header.startsWith('x-amz-meta-')) {
        metadata[header.slice(11)] = value as string;
      }
    }

    const result = await this.objectService.putObject(
      bucket,
      key,
      body,
      contentType,
      metadata,
    );

    res
      .status(200)
      .header('ETag', `"${result.etag}"`)
      .header('x-amz-request-id', uuid())
      .send();
  }

  private async handleGetObject(
    bucket: string,
    key: string,
    req: Request,
    res: Response,
  ) {
    const result = await this.objectService.getObject(bucket, key);

    res
      .status(200)
      .header('Content-Type', result.contentType)
      .header('Content-Length', result.size.toString())
      .header('ETag', `"${result.etag}"`)
      .header('Last-Modified', result.lastModified.toUTCString())
      .header('Accept-Ranges', 'bytes')
      .header('x-amz-request-id', uuid());

    // Set metadata headers
    for (const [key, value] of Object.entries(result.metadata)) {
      res.header(`x-amz-meta-${key}`, value as string);
    }

    res.send(result.body);
  }

  private async handleHeadObject(
    bucket: string,
    key: string,
    req: Request,
    res: Response,
  ) {
    const result = await this.objectService.headObject(bucket, key);

    res
      .status(200)
      .header('Content-Type', result.contentType)
      .header('Content-Length', result.size.toString())
      .header('ETag', `"${result.etag}"`)
      .header('Last-Modified', result.lastModified.toUTCString())
      .header('Accept-Ranges', 'bytes')
      .header('x-amz-request-id', uuid());

    for (const [key, value] of Object.entries(result.metadata)) {
      res.header(`x-amz-meta-${key}`, value as string);
    }

    res.send();
  }

  private async handleDeleteObject(
    bucket: string,
    key: string,
    req: Request,
    res: Response,
  ) {
    await this.objectService.deleteObject(bucket, key);
    res.status(204).header('x-amz-request-id', uuid()).send();
  }

  private async handleCopyObject(
    bucket: string,
    key: string,
    copySource: string,
    req: Request,
    res: Response,
  ) {
    // Parse source: /bucket/key or bucket/key
    const source = copySource.startsWith('/')
      ? copySource.slice(1)
      : copySource;
    const slashIndex = source.indexOf('/');
    const sourceBucket = source.slice(0, slashIndex);
    const sourceKey = decodeURIComponent(source.slice(slashIndex + 1));

    const result = await this.objectService.copyObject(
      sourceBucket,
      sourceKey,
      bucket,
      key,
    );

    const xml = this.objectService.buildCopyResult(result.etag, result.lastModified);
    this.sendXml(res, xml);
  }

  private async handleInitiateMultipart(
    bucket: string,
    key: string,
    req: Request,
    res: Response,
  ) {
    const contentType =
      (req.headers['content-type'] as string) || 'application/octet-stream';
    const metadata: Record<string, string> = {};
    for (const [header, value] of Object.entries(req.headers)) {
      if (header.startsWith('x-amz-meta-')) {
        metadata[header.slice(11)] = value as string;
      }
    }

    const xml = await this.multipartService.initiate(
      bucket,
      key,
      contentType,
      metadata,
    );
    this.sendXml(res, xml);
  }

  private async handleUploadPart(
    bucket: string,
    key: string,
    req: Request,
    res: Response,
  ) {
    const uploadId = req.query['uploadId'] as string;
    const partNumber = parseInt(req.query['partNumber'] as string);
    const body = (req as any).body as Buffer;

    const etag = await this.multipartService.uploadPart(
      bucket,
      uploadId,
      partNumber,
      body,
    );

    res
      .status(200)
      .header('ETag', `"${etag}"`)
      .header('x-amz-request-id', uuid())
      .send();
  }

  private async handleCompleteMultipart(
    bucket: string,
    key: string,
    req: Request,
    res: Response,
  ) {
    const uploadId = req.query['uploadId'] as string;
    const body = (req as any).body as Buffer;

    const xml = await this.multipartService.complete(bucket, key, uploadId, body);
    this.sendXml(res, xml);
  }

  private async handleAbortMultipart(
    bucket: string,
    key: string,
    req: Request,
    res: Response,
  ) {
    const uploadId = req.query['uploadId'] as string;
    await this.multipartService.abort(bucket, uploadId);
    res.status(204).header('x-amz-request-id', uuid()).send();
  }

  private async handleListParts(
    bucket: string,
    key: string,
    req: Request,
    res: Response,
  ) {
    const uploadId = req.query['uploadId'] as string;
    const xml = await this.multipartService.listParts(bucket, key, uploadId);
    this.sendXml(res, xml);
  }

  private sendXml(res: Response, xml: string) {
    res
      .status(200)
      .header('Content-Type', 'application/xml')
      .header('x-amz-request-id', uuid())
      .send(xml);
  }
}
