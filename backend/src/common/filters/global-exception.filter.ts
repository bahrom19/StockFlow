import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface RequestWithId extends Request {
  requestId?: string;
}

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const statusCode = this.getStatusCode(exception);
    const message = this.getMessage(exception);
    const error = this.getErrorName(exception);
    const requestId = this.getRequestId(request);

    this.logger.error(
      `${request.method} ${request.url} ${statusCode} ${error} ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    });
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 (unique constraint violation) is a conflict: the write raced a
      // concurrent one or the request was already applied. 409 lets
      // idempotent clients (e.g. the mobile outbox sync) recognize
      // "already exists"; every other known request error stays a 400.
      if (exception.code === 'P2002') {
        return HttpStatus.CONFLICT;
      }
      // P0001 with SQLSTATE 57014 (query_canceled) — PostgreSQL statement
      // timeout fired. The server cancelled the query; the client did
      // nothing wrong. 408 (Request Timeout) is semantically correct.
      if (this.isStatementTimeout(exception)) {
        return HttpStatus.REQUEST_TIMEOUT;
      }
      // P2028 — Prisma interactive transaction timeout exceeded (Prisma 6.x).
      // The transaction ran longer than the configured timeout (default 5s,
      // configured to 30s in PrismaService). 408 is semantically correct.
      if (this.isTransactionTimeout(exception)) {
        return HttpStatus.REQUEST_TIMEOUT;
      }
      return HttpStatus.BAD_REQUEST;
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return HttpStatus.BAD_REQUEST;
    }

    if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      return HttpStatus.BAD_REQUEST;
    }

    if (exception instanceof Prisma.PrismaClientRustPanicError) {
      return HttpStatus.SERVICE_UNAVAILABLE;
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return HttpStatus.SERVICE_UNAVAILABLE;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return HttpStatus.BAD_REQUEST;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const message = response.message;

        if (Array.isArray(message)) {
          return message.join(', ');
        }

        if (typeof message === 'string') {
          return message;
        }
      }

      return 'Unexpected error';
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return this.getP2002Message(exception);
      }

      if (exception.code === 'P2025') {
        return 'The requested record was not found';
      }

      if (this.isStatementTimeout(exception)) {
        return 'Query timeout: the database query exceeded the allowed time limit';
      }

      if (this.isTransactionTimeout(exception)) {
        return 'Transaction timeout: the database transaction exceeded the allowed time limit';
      }

      return 'Database operation failed';
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return 'Invalid database query';
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }

  private getErrorName(exception: unknown): string {
    if (exception instanceof BadRequestException) {
      return 'Bad Request';
    }

    if (exception instanceof UnauthorizedException) {
      return 'Unauthorized';
    }

    if (exception instanceof ForbiddenException) {
      return 'Forbidden';
    }

    if (exception instanceof NotFoundException) {
      return 'Not Found';
    }

    if (exception instanceof ConflictException) {
      return 'Conflict';
    }

    if (exception instanceof UnprocessableEntityException) {
      return 'Unprocessable Entity';
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (this.isStatementTimeout(exception)) {
        return 'Request Timeout';
      }
      if (this.isTransactionTimeout(exception)) {
        return 'Request Timeout';
      }
      return 'Prisma Error';
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return 'Prisma Validation Error';
    }

    if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      return 'Prisma Unknown Error';
    }

    if (exception instanceof Prisma.PrismaClientRustPanicError) {
      return 'Prisma Rust Panic';
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return 'Prisma Initialization Error';
    }

    if (exception instanceof Error) {
      return exception.name;
    }

    return 'Internal Server Error';
  }

  /**
   * Extract a field-specific message from a P2002 unique constraint violation.
   * Inspects `meta.target` (an array of column names) to provide a more
   * helpful error message than the generic fallback.
   */
  private getP2002Message(
    exception: Prisma.PrismaClientKnownRequestError,
  ): string {
    const target = exception.meta?.target;

    if (Array.isArray(target)) {
      if (target.includes('sku')) {
        return 'A product with this SKU already exists';
      }
      if (target.includes('barcode')) {
        return 'A product with this barcode already exists';
      }
      if (target.includes('bin')) {
        return 'A supplier with this BIN already exists';
      }
    }

    return 'A record with the same unique value already exists';
  }

  /**
   * Detect Prisma interactive transaction timeout (P2028).
   * This error is thrown when a $transaction(fn) callback exceeds the
   * configured transaction timeout (default 5s, configured to 30s).
   * In Prisma 6.x, the error code for interactive transaction timeout is P2028,
   * not P2024.
   */
  private isTransactionTimeout(
    exception: Prisma.PrismaClientKnownRequestError,
  ): boolean {
    return exception.code === 'P2028';
  }

  /**
   * Detect PostgreSQL statement_timeout (SQLSTATE 57014 / query_canceled).
   * Prisma wraps raw PostgreSQL errors as P0001 with the original SQLSTATE
   * in `meta.code`. This method identifies the specific case where
   * PostgreSQL cancelled a query due to `statement_timeout`.
   */
  private isStatementTimeout(
    exception: Prisma.PrismaClientKnownRequestError,
  ): boolean {
    return exception.code === 'P0001' && exception.meta?.code === '57014';
  }

  private getRequestId(request: RequestWithId): string {
    const requestId = request.requestId;

    if (typeof requestId === 'string' && requestId.trim()) {
      return requestId;
    }

    const headerValue = request.headers['x-request-id'];

    if (Array.isArray(headerValue)) {
      return headerValue[0] ?? 'unknown';
    }

    return headerValue ?? 'unknown';
  }
}
