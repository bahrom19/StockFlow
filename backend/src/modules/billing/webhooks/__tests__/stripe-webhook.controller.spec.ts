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
      controller.handleStripeWebhook(reqFor(forgedCheckoutBody), undefined as any),
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
});
