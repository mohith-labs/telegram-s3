import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { S3Exception } from '../guards/s3-exception';
import { buildErrorXml } from '../utils/xml-builder';
import { v4 as uuid } from 'uuid';

@Catch()
export class S3ExceptionFilter implements ExceptionFilter {
  private logger = new Logger('S3ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    if (exception instanceof S3Exception) {
      response
        .status(exception.getStatus())
        .header('Content-Type', 'application/xml')
        .header('x-amz-request-id', uuid())
        .send(exception.getResponse());
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      this.logger.error(
        `HttpException ${status} on ${request.method} ${request.path}: ${exception.message}`,
      );
      const xml = buildErrorXml(
        'InternalError',
        exception.message,
        request.path,
        uuid(),
      );
      response
        .status(status)
        .header('Content-Type', 'application/xml')
        .header('x-amz-request-id', uuid())
        .send(xml);
      return;
    }

    this.logger.error(
      `Unhandled error on ${request.method} ${request.path}:`,
      exception instanceof Error ? exception.stack : exception,
    );
    const xml = buildErrorXml(
      'InternalError',
      'We encountered an internal error. Please try again.',
      request.path,
      uuid(),
    );
    response
      .status(500)
      .header('Content-Type', 'application/xml')
      .header('x-amz-request-id', uuid())
      .send(xml);
  }
}
