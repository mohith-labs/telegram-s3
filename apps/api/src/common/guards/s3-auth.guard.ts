import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { KeysService } from '../../modules/keys/keys.service';
import {
  parseAuthorizationHeader,
  parsePresignedQuery,
  verifySignature,
} from '../utils/sigv4';
import { S3Exception } from './s3-exception';

@Injectable()
export class S3AuthGuard implements CanActivate {
  private logger = new Logger(S3AuthGuard.name);

  constructor(private keysService: KeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'] as string;

    let accessKeyId: string;
    let expectedSignature: string;
    let signedHeaders: string[];
    let dateStamp: string;
    let region: string;
    let service: string;
    let amzDate: string;

    if (authHeader && authHeader.startsWith('AWS4-HMAC-SHA256')) {
      const parsed = parseAuthorizationHeader(authHeader);
      if (!parsed) {
        throw new S3Exception('SignatureDoesNotMatch', request.path);
      }
      accessKeyId = parsed.accessKeyId;
      expectedSignature = parsed.signature;
      signedHeaders = parsed.signedHeaders;
      dateStamp = parsed.dateStamp;
      region = parsed.region;
      service = parsed.service;
      amzDate = (request.headers['x-amz-date'] as string) || '';
    } else if (request.query['X-Amz-Algorithm']) {
      const parsed = parsePresignedQuery(request.query as Record<string, string>);
      if (!parsed) {
        throw new S3Exception('SignatureDoesNotMatch', request.path);
      }
      accessKeyId = parsed.accessKeyId;
      expectedSignature = parsed.signature;
      signedHeaders = parsed.signedHeaders;
      dateStamp = parsed.dateStamp;
      region = parsed.region;
      service = parsed.service;
      amzDate = parsed.date;
    } else {
      throw new S3Exception('AccessDenied', request.path);
    }

    // Look up key
    const key = await this.keysService.findByAccessKeyId(accessKeyId);
    if (!key || !key.isActive) {
      throw new S3Exception('AccessDenied', request.path);
    }

    // Build headers map (lowercase)
    const headersMap: Record<string, string> = {};
    for (const h of signedHeaders) {
      headersMap[h] = (request.headers[h] as string) || '';
    }

    // Get payload hash
    const payloadHash =
      (request.headers['x-amz-content-sha256'] as string) || 'UNSIGNED-PAYLOAD';

    // Build query string (sorted)
    const queryParams = { ...request.query };
    delete queryParams['X-Amz-Signature']; // Exclude from presigned
    const sortedQuery = Object.keys(queryParams)
      .sort()
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k] as string)}`,
      )
      .join('&');

    const isValid = verifySignature({
      method: request.method,
      path: request.path,
      queryString: sortedQuery,
      headers: headersMap,
      signedHeaders,
      payloadHash,
      secretAccessKey: key.secretAccessKey,
      dateStamp,
      amzDate,
      region,
      service,
      expectedSignature,
    });

    if (!isValid) {
      this.logger.warn(`Signature mismatch for key ${accessKeyId}`);
      throw new S3Exception('SignatureDoesNotMatch', request.path);
    }

    // Store key info on request for permission checks
    (request as any).s3Key = key;
    return true;
  }
}

