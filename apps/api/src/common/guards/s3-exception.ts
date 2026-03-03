import { HttpException } from '@nestjs/common';
import { S3_ERROR_CODES, S3ErrorCode } from '@tgs3/shared';
import { buildErrorXml } from '../utils/xml-builder';
import { v4 as uuid } from 'uuid';

export class S3Exception extends HttpException {
  constructor(
    public readonly code: S3ErrorCode,
    public readonly resource: string,
  ) {
    const error = S3_ERROR_CODES[code];
    const requestId = uuid();
    const body = buildErrorXml(code, error.message, resource, requestId);

    super(body, error.status);
  }
}
