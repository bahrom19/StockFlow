import { BadRequestException } from '@nestjs/common';
import { StripeWebhookController } from '../stripe-webhook.controller';

describe('StripeWebhookController (G13-03-08-01 fail-closed gate)', () => {
  let controller: StripeWebhookController;
  let engine: { verifySignature: jest.Mock; handleWebhook: jest.Mock };

  const forgedCheckoutBody = {
    id: 'evt_forged',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_forged',
        customer: 'cus_forged',
        metadata: { companyId: 'comp-1', planCode: 'business' },
      },
    },
  };
  const forgedDeletedBody = {
    id: 'evt_forged_del',
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_forged' } },
  };
  const forgedRefundBody = {
    id: 'evt_forged_ref',
    type: 'charge.refunded',
    data: {
      object: {
        id: 'ch_forged',
        payment_intent: 'pi_forged',
        amount_refunded: 1000,
        currency: 'usd',
      },
    },
  };

  const reqFor = (body: unknown) =>
    ({
      body,
      rawBody: Buffer.from(JSON.stringify(body)),
    }) as any;

  beforeEach(() => {
    engine = {
      verifySignature: jest.fn(),
      handleWebhook: jest.fn().mockResolvedValue(undefined),
    };
    controller = new StripeWebhookController(engine as any);
  });

  it('should reject a missing signature with 400 without invoking the engine', async () => {
    await expect(
      controller.handleStripeWebhook(
        reqFor(forgedCheckoutBody),
        undefined as any,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(engine.verifySignature).not.toHaveBeenCalled();
    expect(engine.handleWebhook).not.toHaveBeenCalled();
  });

  it('should reject an empty signature with 400 without invoking the engine', async () => {
    await expect(
      controller.handleStripeWebhook(reqFor(forgedCheckoutBody), ''),
    ).rejects.toThrow(BadRequestException);
    expect(engine.handleWebhook).not.toHaveBeenCalled();
  });

  it('should reject an invalid signature with 400 without invoking the engine', async () => {
    engine.verifySignature.mockReturnValue(false);

    await expect(
      controller.handleStripeWebhook(
        reqFor(forgedCheckoutBody),
        't=123,v1=deadbeef',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(engine.verifySignature).toHaveBeenCalledTimes(1);
    expect(engine.handleWebhook).not.toHaveBeenCalled();
  });

  it('should process a valid signature exactly once', async () => {
    engine.verifySignature.mockReturnValue(true);
    const body = forgedCheckoutBody;

    const result = await controller.handleStripeWebhook(
      reqFor(body),
      't=123,v1=valid',
    );

    expect(result).toEqual({ received: true });
    expect(engine.verifySignature).toHaveBeenCalledTimes(1);
    expect(engine.handleWebhook).toHaveBeenCalledTimes(1);
    expect(engine.handleWebhook).toHaveBeenCalledWith(body);
  });

  it.each([
    ['checkout.session.completed', forgedCheckoutBody],
    ['customer.subscription.deleted', forgedDeletedBody],
    ['charge.refunded', forgedRefundBody],
  ])(
    'should never deliver forged %s to the engine without a signature',
    async (_type, body) => {
      await expect(
        controller.handleStripeWebhook(reqFor(body), undefined as any),
      ).rejects.toThrow(BadRequestException);
      expect(engine.handleWebhook).not.toHaveBeenCalled();
    },
  );

  // ── G16-N-4 P1-B: raw request bytes are the only verification source ──
  // The previous controller verified `JSON.stringify(req.body)`, i.e. a
  // re-serialized parse tree that is NOT guaranteed to equal the bytes Stripe
  // signed. These tests pin the raw-byte contract, including the regression
  // that motivated it: unit tests that mock `rawBody` can hide the fact that
  // production never populated it (the real wiring is proved by
  // stripe-webhook.routes.integration.spec.ts).
  it('passes the exact raw Buffer to verifySignature and handles the event once', async () => {
    engine.verifySignature.mockReturnValue(true);
    const raw = Buffer.from(JSON.stringify(forgedCheckoutBody), 'utf8');
    const req = { body: forgedCheckoutBody, rawBody: raw } as any;

    const result = await controller.handleStripeWebhook(req, 't=123,v1=valid');

    expect(result).toEqual({ received: true });
    // The Buffer itself — not a string, not a re-serialization of req.body.
    const verified = engine.verifySignature.mock.calls[0][0];
    expect(Buffer.isBuffer(verified)).toBe(true);
    expect(verified).toBe(raw);
    expect(
      verified.equals(Buffer.from(JSON.stringify(forgedCheckoutBody), 'utf8')),
    ).toBe(true);
    expect(engine.handleWebhook).toHaveBeenCalledTimes(1);
    expect(engine.handleWebhook).toHaveBeenCalledWith(forgedCheckoutBody);
  });

  it('passes formatting-differing raw bytes through unchanged', async () => {
    engine.verifySignature.mockReturnValue(true);
    // Whitespace + escaped slashes: a re-serialization would collapse both.
    const rawText =
      '{ "id": "evt_raw",  "object": "event", "data": { "object": { "url": "https:\\/\\/example.com" } } }';
    const parsed = JSON.parse(rawText);
    expect(JSON.stringify(parsed)).not.toBe(rawText); // the whole point
    const raw = Buffer.from(rawText, 'utf8');

    await controller.handleStripeWebhook(
      { body: parsed, rawBody: raw } as any,
      't=123,v1=valid',
    );

    const verified = engine.verifySignature.mock.calls[0][0];
    expect(verified).toBe(raw);
    expect(verified.toString('utf8')).toBe(rawText);
    expect(engine.handleWebhook).toHaveBeenCalledTimes(1);
  });

  it('fails closed with 400 when rawBody is absent (no JSON.stringify fallback)', async () => {
    engine.verifySignature.mockReturnValue(true);
    // Exactly what production produced before the raw-body bootstrap fix.
    const req = { body: forgedCheckoutBody } as any;

    await expect(
      controller.handleStripeWebhook(req, 't=123,v1=valid'),
    ).rejects.toThrow(BadRequestException);

    // Fail closed BEFORE any crypto or business work.
    expect(engine.verifySignature).not.toHaveBeenCalled();
    expect(engine.handleWebhook).not.toHaveBeenCalled();
  });

  it('fails closed with 400 when rawBody is not a Buffer', async () => {
    engine.verifySignature.mockReturnValue(true);
    const req = {
      body: forgedCheckoutBody,
      rawBody: JSON.stringify(forgedCheckoutBody),
    } as any;

    await expect(
      controller.handleStripeWebhook(req, 't=123,v1=valid'),
    ).rejects.toThrow(BadRequestException);

    expect(engine.verifySignature).not.toHaveBeenCalled();
    expect(engine.handleWebhook).not.toHaveBeenCalled();
  });

  it('fails closed with 400 when rawBody is empty', async () => {
    engine.verifySignature.mockReturnValue(true);
    const req = { body: forgedCheckoutBody, rawBody: Buffer.alloc(0) } as any;

    await expect(
      controller.handleStripeWebhook(req, 't=123,v1=valid'),
    ).rejects.toThrow(BadRequestException);

    expect(engine.verifySignature).not.toHaveBeenCalled();
    expect(engine.handleWebhook).not.toHaveBeenCalled();
  });
});
