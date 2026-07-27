import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

interface RequestWithId extends Request {
  requestId: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestIdMiddleware.name);

  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const incomingRequestId = req.headers['x-request-id'];
    const requestId = this.normalizeRequestId(incomingRequestId);

    req.requestId = requestId;
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    this.logger.log(`[${requestId}] ${req.method} ${req.originalUrl}`);
    next();
  }

  private normalizeRequestId(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
      const firstValue = value.find(Boolean);
      return firstValue?.trim() || randomUUID();
    }

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    return randomUUID();
  }
}
