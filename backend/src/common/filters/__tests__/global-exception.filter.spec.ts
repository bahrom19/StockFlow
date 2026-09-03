import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalExceptionFilter } from '../global-exception.filter';

function createHost(
  requestId?: string,
  headerRequestId?: string,
): {
  host: ArgumentsHost;
  statusMock: jest.Mock;
  jsonMock: jest.Mock;
} {
  const request = {
    method: 'POST',
    url: '/api/test',
    requestId,
    headers: headerRequestId ? { 'x-request-id': headerRequestId } : {},
  };
  const statusMock = jest.fn().mockReturnThis();
  const jsonMock = jest.fn();
  const response = { status: statusMock, json: jsonMock };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, statusMock, jsonMock };
}

function p2002(
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`saleNumber`)',
    { code: 'P2002', clientVersion: 'test', meta },
  );
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  // ─────────────────────────────────────────────
  // PRISMA KNOWN REQUEST ERRORS
  // ─────────────────────────────────────────────
  it('maps P2002 (unique constraint) to HTTP 409 Conflict', () => {
    const { host, statusMock, jsonMock } = createHost();
    filter.catch(p2002({ target: ['saleNumber'] }), host);

    expect(statusMock).toHaveBeenCalledWith(409);
    const body = jsonMock.mock.calls[0][0];
    expect(body.statusCode).toBe(409);
    expect(body.success).toBe(false);
    expect(body.message).toBe(
      'A record with the same unique value already exists',
    );
    expect(body.error).toBe('Prisma Error');
  });

  it('maps P2002 to 409 even without meta target', () => {
    const { host, statusMock } = createHost();
    filter.catch(p2002(), host);

    expect(statusMock).toHaveBeenCalledWith(409);
  });

  it('P2002 with SKU target → field-specific message', () => {
    const { host, jsonMock } = createHost();
    filter.catch(
      p2002({ target: ['companyId', 'sku'] }),
      host,
    );

    const body = jsonMock.mock.calls[0][0];
    expect(body.statusCode).toBe(409);
    expect(body.message).toBe('A product with this SKU already exists');
  });

  it('P2002 with barcode target → field-specific message', () => {
    const { host, jsonMock } = createHost();
    filter.catch(
      p2002({ target: ['companyId', 'barcode'] }),
      host,
    );

    const body = jsonMock.mock.calls[0][0];
    expect(body.statusCode).toBe(409);
    expect(body.message).toBe('A product with this barcode already exists');
  });

  it('P2002 with bin target → field-specific message', () => {
    const { host, jsonMock } = createHost();
    filter.catch(
      p2002({ target: ['companyId', 'bin'] }),
      host,
    );

    const body = jsonMock.mock.calls[0][0];
    expect(body.statusCode).toBe(409);
    expect(body.message).toBe('A supplier with this BIN already exists');
  });

  it('P2002 with unknown target → generic message', () => {
    const { host, jsonMock } = createHost();
    filter.catch(
      p2002({ target: ['companyId', 'email'] }),
      host,
    );

    const body = jsonMock.mock.calls[0][0];
    expect(body.statusCode).toBe(409);
    expect(body.message).toBe(
      'A record with the same unique value already exists',
    );
  });

  it('P2002 with non-array target → generic message', () => {
    const { host, jsonMock } = createHost();
    filter.catch(
      p2002({ target: 'sku' }),
      host,
    );

    const body = jsonMock.mock.calls[0][0];
    expect(body.statusCode).toBe(409);
    expect(body.message).toBe(
      'A record with the same unique value already exists',
    );
  });

  it('keeps P2025 (record not found) at HTTP 400', () => {
    const { host, statusMock, jsonMock } = createHost();
    const err = new Prisma.PrismaClientKnownRequestError('not found', {
      code: 'P2025',
      clientVersion: 'test',
    });
    filter.catch(err, host);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock.mock.calls[0][0].message).toBe(
      'The requested record was not found',
    );
  });

  it('keeps other known request errors (e.g. P0001) at HTTP 400', () => {
    const { host, statusMock, jsonMock } = createHost();
    const err = new Prisma.PrismaClientKnownRequestError('custom failure', {
      code: 'P0001',
      clientVersion: 'test',
    });
    filter.catch(err, host);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock.mock.calls[0][0].message).toBe('Database operation failed');
  });

  // ─────────────────────────────────────────────
  // OTHER PRISMA ERRORS — UNCHANGED
  // ─────────────────────────────────────────────
  it('keeps PrismaClientValidationError at HTTP 400', () => {
    const { host, statusMock } = createHost();
    const err = new Prisma.PrismaClientValidationError('bad query', {
      clientVersion: 'test',
    });
    filter.catch(err, host);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('keeps PrismaClientUnknownRequestError at HTTP 400', () => {
    const { host, statusMock } = createHost();
    const err = new Prisma.PrismaClientUnknownRequestError('db blew up', {
      clientVersion: 'test',
    });
    filter.catch(err, host);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('keeps PrismaClientInitializationError at HTTP 503', () => {
    const { host, statusMock } = createHost();
    const err = new Prisma.PrismaClientInitializationError(
      'no connection',
      'test',
    );
    filter.catch(err, host);

    expect(statusMock).toHaveBeenCalledWith(503);
  });

  it('keeps PrismaClientRustPanicError at HTTP 503', () => {
    const { host, statusMock } = createHost();
    const err = new Prisma.PrismaClientRustPanicError('panic', 'test');
    filter.catch(err, host);

    expect(statusMock).toHaveBeenCalledWith(503);
  });

  // ─────────────────────────────────────────────
  // HTTP EXCEPTIONS — UNCHANGED
  // ─────────────────────────────────────────────
  it('keeps ConflictException at HTTP 409', () => {
    const { host, statusMock, jsonMock } = createHost();
    filter.catch(new ConflictException('Sale number already exists'), host);

    expect(statusMock).toHaveBeenCalledWith(409);
    const body = jsonMock.mock.calls[0][0];
    expect(body.message).toBe('Sale number already exists');
    expect(body.error).toBe('Conflict');
  });

  it('keeps NotFoundException at HTTP 404', () => {
    const { host, statusMock } = createHost();
    filter.catch(new NotFoundException('missing'), host);

    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('keeps BadRequestException at HTTP 400', () => {
    const { host, statusMock } = createHost();
    filter.catch(new BadRequestException('invalid'), host);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('keeps UnauthorizedException at HTTP 401', () => {
    const { host, statusMock } = createHost();
    filter.catch(new UnauthorizedException(), host);

    expect(statusMock).toHaveBeenCalledWith(401);
  });

  it('maps validation pipe array messages to a joined string', () => {
    const { host, jsonMock } = createHost();
    const err = new BadRequestException(['email must be an email']);
    filter.catch(err, host);

    expect(jsonMock.mock.calls[0][0].message).toBe('email must be an email');
  });

  // ─────────────────────────────────────────────
  // FALLBACKS & RESPONSE SHAPE
  // ─────────────────────────────────────────────
  it('maps unknown errors to HTTP 500', () => {
    const { host, statusMock } = createHost();
    filter.catch(new Error('boom'), host);

    expect(statusMock).toHaveBeenCalledWith(500);
  });

  it('includes requestId from the request object', () => {
    const { host, jsonMock } = createHost('req-42');
    filter.catch(p2002(), host);

    expect(jsonMock.mock.calls[0][0].requestId).toBe('req-42');
  });

  it('falls back to the x-request-id header', () => {
    const { host, jsonMock } = createHost(undefined, 'hdr-7');
    filter.catch(p2002(), host);

    expect(jsonMock.mock.calls[0][0].requestId).toBe('hdr-7');
  });

  it('uses "unknown" when no request id exists', () => {
    const { host, jsonMock } = createHost();
    filter.catch(p2002(), host);

    expect(jsonMock.mock.calls[0][0].requestId).toBe('unknown');
  });
});
