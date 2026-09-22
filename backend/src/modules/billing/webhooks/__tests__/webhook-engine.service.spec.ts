import { createHmac } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WebhookEngineService } from '../webhook-engine.service';

describe('WebhookEngineService.verifySignature (G13-03-08-01 fail-closed)', () => {
  const secret = 'whsec_test_secret_123';
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
  const timestamp = '1710000000';

  function sign(secretKey: string, body: string, ts: string): string {
    const hex = createHmac('sha256', secretKey)
      .update(`${ts}.${body}`)
      .digest('hex');
    return `t=${ts},v1=${hex}`;
  }

  function makeEngine(secretValue: string, skipVerify: boolean) {
    const configService = {
      get: jest.fn((key: string, def?: unknown) => {
        if (key === 'app.stripeWebhookSecret') return secretValue;
        if (key === 'app.stripeWebhookSkipVerify') return skipVerify;
        return def;
      }),
    };
    return new WebhookEngineService(
      configService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  it('should return false when the secret is missing and bypass is disabled', () => {
    const engine = makeEngine('', false);
    expect(engine.verifySignature(payload, sign(secret, payload, timestamp))).toBe(
      false,
    );
  });

  it('should return true only via explicit bypass when enabled', () => {
    const engine = makeEngine('', true);
    expect(engine.verifySignature(payload, 'anything-at-all')).toBe(true);
  });

  it('should return false for a signature made with the wrong secret', () => {
    const engine = makeEngine(secret, false);
    expect(
      engine.verifySignature(payload, sign('whsec_wrong_secret', payload, timestamp)),
    ).toBe(false);
  });

  it('should return true for a valid Stripe signature vector', () => {
    const engine = makeEngine(secret, false);
    expect(
      engine.verifySignature(payload, sign(secret, payload, timestamp)),
    ).toBe(true);
  });

  it('should return false for malformed signatures', () => {
    const engine = makeEngine(secret, false);
    expect(engine.verifySignature(payload, 'not-a-signature')).toBe(false);
    expect(engine.verifySignature(payload, 't=123')).toBe(false);
    expect(engine.verifySignature(payload, 'v1=deadbeef')).toBe(false);
    expect(engine.verifySignature(payload, '')).toBe(false);
  });
});

describe('WebhookEngineService.handleSubscriptionDeleted (G13-03-08-02 single event)', () => {
  const sub = { id: 'sub-1', companyId: 'comp-1' };

  function makeDeletionEngine(cancelImpl: () => Promise<unknown>) {
    const eventBus = { publish: jest.fn() };
    const companySubscriptionService = {
      cancel: jest.fn().mockImplementation(cancelImpl),
    };
    const prismaService = {
      companySubscription: {
        findMany: jest.fn().mockResolvedValue([sub]),
      },
    };
    const engine = new WebhookEngineService(
      { get: jest.fn() } as any,
      prismaService as any,
      {} as any,
      companySubscriptionService as any,
      {} as any,
      {} as any,
      {} as any,
      eventBus as any,
    );
    return { engine, eventBus, companySubscriptionService };
  }

  it('should not publish SubscriptionCancelledEvent itself on provider deletion', async () => {
    const { engine, eventBus, companySubscriptionService } =
      makeDeletionEngine(async () => ({ id: 'sub-1' }));

    await (engine as any).handleSubscriptionDeleted({ id: 'sub_prov_1' });

    // The single event comes from cancel() (mocked service boundary);
    // the handler must not add a second publication.
    expect(companySubscriptionService.cancel).toHaveBeenCalledWith(
      'comp-1',
      'Provider subscription deleted',
      expect.anything(),
    );
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('should not publish anything when cancel() fails', async () => {
    const { engine, eventBus } = makeDeletionEngine(async () => {
      throw new Error('already cancelled');
    });

    await expect(
      (engine as any).handleSubscriptionDeleted({ id: 'sub_prov_1' }),
    ).rejects.toThrow('already cancelled');
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});

describe('WebhookEngineService.handleChargeRefunded (G13-03-08-03 idempotency)', () => {
  const invoiceA = {
    id: 'inv-A',
    companyId: 'comp-A',
    subscriptionId: 'sub-A',
    invoiceNumber: 'INV-A-0001',
  };
  const chargeObject = {
    id: 'ch_1',
    invoice: 'in_1',
    amount_refunded: 1000,
    currency: 'usd',
  };

  function makeRefundEngine(opts: {
    invoiceRow?: unknown;
    createImpl?: (...args: any[]) => Promise<unknown>;
  }) {
    const invoice = {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'invoiceRow' in opts ? opts.invoiceRow : invoiceA,
        ),
    };
    const create =
      opts.createImpl !== undefined
        ? jest.fn().mockImplementation(opts.createImpl)
        : jest.fn().mockResolvedValue({ id: 'pmt-ref-1' });
    const engine = new WebhookEngineService(
      { get: jest.fn() } as any,
      { invoice } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { create } as any,
      { publish: jest.fn() } as any,
    );
    return { engine, invoice, create };
  }

  function p2002() {
    return new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`idempotencyKey`)',
      { code: 'P2002', clientVersion: 'test' },
    );
  }

  it('should record a valid refund once with a deterministic idempotency key', async () => {
    const { engine, create } = makeRefundEngine({});

    await (engine as any).handleChargeRefunded({ ...chargeObject });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'REFUNDED',
        idempotencyKey: 'stripe-refund:ch_1:1000',
      }),
    );
  });

  it('should attach the refund to the owning company only (tenant isolation)', async () => {
    const { engine, create } = makeRefundEngine({});

    await (engine as any).handleChargeRefunded({ ...chargeObject });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        company: { connect: { id: 'comp-A' } },
        subscription: { connect: { id: 'sub-A' } },
        invoice: { connect: { id: 'inv-A' } },
      }),
    );
  });

  it('should treat a sequential duplicate as already processed (no second row)', async () => {
    const inserted = new Set<string>();
    const { engine, create } = makeRefundEngine({
      createImpl: async (data: any) => {
        if (inserted.has(data.idempotencyKey)) throw p2002();
        inserted.add(data.idempotencyKey);
        return { id: 'pmt-ref-1' };
      },
    });

    await (engine as any).handleChargeRefunded({ ...chargeObject });
    await (engine as any).handleChargeRefunded({ ...chargeObject });

    expect(create).toHaveBeenCalledTimes(2);
    expect(inserted.size).toBe(1);
  });

  it('should resolve a concurrent duplicate via the unique constraint (no throw, one row)', async () => {
    const inserted = new Set<string>();
    const { engine } = makeRefundEngine({
      createImpl: async (data: any) => {
        // Simulates two overlapping inserts racing on the UNIQUE key:
        // the loser observes P2002, exactly as PostgreSQL would report it.
        if (inserted.has(data.idempotencyKey)) throw p2002();
        inserted.add(data.idempotencyKey);
        return { id: 'pmt-ref-1' };
      },
    });

    await expect(
      Promise.all([
        (engine as any).handleChargeRefunded({ ...chargeObject }),
        (engine as any).handleChargeRefunded({ ...chargeObject }),
      ]),
    ).resolves.toBeDefined();
    expect(inserted.size).toBe(1);
  });

  it('should resolve when the refund row already exists (crash-retry path)', async () => {
    const { engine, create } = makeRefundEngine({
      createImpl: async () => {
        throw p2002();
      },
    });

    await expect(
      (engine as any).handleChargeRefunded({ ...chargeObject }),
    ).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('should rethrow non-unique DB errors instead of swallowing them', async () => {
    const { engine } = makeRefundEngine({
      createImpl: async () => {
        throw new Error('connection lost');
      },
    });

    await expect(
      (engine as any).handleChargeRefunded({ ...chargeObject }),
    ).rejects.toThrow('connection lost');
  });

  it('should never run an unfiltered lookup when the charge id is missing', async () => {
    const { engine, invoice, create } = makeRefundEngine({});

    await (engine as any).handleChargeRefunded({
      invoice: 'in_1',
      amount_refunded: 100,
    });

    expect(invoice.findFirst).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('should never run an unfiltered lookup when the invoice reference is missing or invalid', async () => {
    for (const object of [
      { id: 'ch_2', amount_refunded: 100 },
      { id: 'ch_3', invoice: undefined, amount_refunded: 100 },
      { id: 'ch_4', invoice: '', amount_refunded: 100 },
      { id: 'ch_5', invoice: 12345, amount_refunded: 100 },
    ]) {
      const { engine, invoice, create } = makeRefundEngine({});
      await (engine as any).handleChargeRefunded(object);
      expect(invoice.findFirst).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    }
  });

  it('should create nothing when the invoice reference is unknown', async () => {
    const { engine, invoice, create } = makeRefundEngine({
      invoiceRow: null,
    });

    await (engine as any).handleChargeRefunded({ ...chargeObject });

    expect(invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerInvoiceId: 'in_1' } }),
    );
    expect(create).not.toHaveBeenCalled();
  });
});

describe('WebhookEngineService already-applied convergence (G13-03-09-01)', () => {
  const invoiceRow = {
    id: 'inv-1',
    companyId: 'comp-1',
    subscriptionId: 'sub-1',
    totalAmount: 29.99,
    currency: 'USD',
  };
  const pastDueSub = { id: 'sub-1', companyId: 'comp-1', status: 'PAST_DUE' };
  const activeSub = { id: 'sub-1', companyId: 'comp-1', status: 'ACTIVE' };

  function makeConvergenceEngine(opts: {
    invoiceFindFirst?: unknown;
    findByCompanyImpl?: (companyId: string) => Promise<unknown>;
    markPaidImpl?: (...args: any[]) => Promise<unknown>;
    transitionImpl?: (...args: any[]) => Promise<unknown>;
    cancelImpl?: (...args: any[]) => Promise<unknown>;
    findManySubs?: unknown[];
  }) {
    const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    const webhookEvent = {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    };
    const invoice = {
      findFirst: jest
        .fn()
        .mockImplementation(async () => opts.invoiceFindFirst ?? null),
    };
    const subscriptionRepository = {
      findByCompany: jest
        .fn()
        .mockImplementation(
          async (companyId: string) =>
            opts.findByCompanyImpl?.(companyId) ?? null,
        ),
      updateByCompany: jest.fn().mockResolvedValue({}),
    };
    const invoiceService = {
      markPaid: jest
        .fn()
        .mockImplementation(opts.markPaidImpl ?? (async () => ({}))),
    };
    const companySubscriptionService = {
      transitionStatus: jest
        .fn()
        .mockImplementation(opts.transitionImpl ?? (async () => ({}))),
      cancel: jest
        .fn()
        .mockImplementation(opts.cancelImpl ?? (async () => ({}))),
    };
    const eventBus = { publish: jest.fn() };
    const engine = new WebhookEngineService(
      { get: jest.fn() } as any,
      {
        invoice,
        companySubscription: {
          findMany: jest.fn().mockResolvedValue(opts.findManySubs ?? []),
        },
        webhookEvent,
      } as any,
      cache as any,
      companySubscriptionService as any,
      invoiceService as any,
      subscriptionRepository as any,
      {} as any,
      eventBus as any,
    );
    return {
      engine,
      invoice,
      subscriptionRepository,
      invoiceService,
      companySubscriptionService,
      eventBus,
      webhookEvent,
    };
  }

  const paidEvent = {
    id: 'evt-paid-1',
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_1',
        payment_intent: 'pi_1',
        amount_paid: 2999,
        currency: 'usd',
      },
    },
  };

  it('should converge an invoice.paid retry when the invoice is already PAID', async () => {
    const { engine, invoiceService, webhookEvent } = makeConvergenceEngine({
      invoiceFindFirst: { ...invoiceRow, status: 'PAID' },
      markPaidImpl: async () => {
        throw new BadRequestException('Invoice inv-1 is not pending');
      },
    });

    const result = await engine.handleWebhook(paidEvent as any);

    expect(result).toEqual({ handled: true, eventType: 'invoice.paid' });
    expect(invoiceService.markPaid).toHaveBeenCalledTimes(1);
    expect(webhookEvent.upsert).toHaveBeenCalledTimes(1);
  });

  it('should rethrow when the invoice is in a genuinely mismatched state', async () => {
    const { engine, webhookEvent } = makeConvergenceEngine({
      invoiceFindFirst: { ...invoiceRow, status: 'CANCELLED' },
      markPaidImpl: async () => {
        throw new BadRequestException('Invoice inv-1 is not pending');
      },
    });

    await expect(engine.handleWebhook(paidEvent as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(webhookEvent.upsert).not.toHaveBeenCalled();
  });

  it('should converge a payment_failed retry when already PAST_DUE', async () => {
    const failedEvent = {
      id: 'evt-fail-1',
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_2', attempt_count: 1 } },
    };
    const { engine, companySubscriptionService, webhookEvent } =
      makeConvergenceEngine({
        invoiceFindFirst: { ...invoiceRow, id: 'inv-2' },
        findByCompanyImpl: async () => pastDueSub,
        transitionImpl: async () => {
          throw new BadRequestException(
            'Cannot transition from PAST_DUE to PAST_DUE',
          );
        },
      });

    const result = await engine.handleWebhook(failedEvent as any);

    expect(result).toEqual({
      handled: true,
      eventType: 'invoice.payment_failed',
    });
    expect(companySubscriptionService.transitionStatus).toHaveBeenCalledTimes(1);
    expect(webhookEvent.upsert).toHaveBeenCalledTimes(1);
  });

  it('should rethrow when the subscription state does not match the event intent', async () => {
    const failedEvent = {
      id: 'evt-fail-2',
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_2', attempt_count: 1 } },
    };
    const { engine, webhookEvent } = makeConvergenceEngine({
      invoiceFindFirst: { ...invoiceRow, id: 'inv-2' },
      findByCompanyImpl: async () => activeSub,
      transitionImpl: async () => {
        throw new BadRequestException('Cannot transition test mismatch');
      },
    });

    await expect(engine.handleWebhook(failedEvent as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(webhookEvent.upsert).not.toHaveBeenCalled();
  });

  it('should converge a subscription.deleted retry when already CANCELLED without republishing', async () => {
    const deletedEvent = {
      id: 'evt-del-1',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_prov_1' } },
    };
    const { engine, companySubscriptionService, eventBus, webhookEvent } =
      makeConvergenceEngine({
        findManySubs: [{ id: 'sub-1', companyId: 'comp-1' }],
        findByCompanyImpl: async () => ({
          ...pastDueSub,
          status: 'CANCELLED',
        }),
        cancelImpl: async () => {
          throw new BadRequestException('Subscription is already CANCELLED');
        },
      });

    const result = await engine.handleWebhook(deletedEvent as any);

    expect(result).toEqual({
      handled: true,
      eventType: 'customer.subscription.deleted',
    });
    expect(companySubscriptionService.cancel).toHaveBeenCalledTimes(1);
    // G13-03-08-02 invariant: no handler-level SubscriptionCancelledEvent.
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(webhookEvent.upsert).toHaveBeenCalledTimes(1);
  });

  it('should rethrow when cancellation finds a non-terminal state', async () => {
    const deletedEvent = {
      id: 'evt-del-2',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_prov_1' } },
    };
    const { engine, webhookEvent } = makeConvergenceEngine({
      findManySubs: [{ id: 'sub-1', companyId: 'comp-1' }],
      findByCompanyImpl: async () => pastDueSub,
      cancelImpl: async () => {
        throw new BadRequestException('Subscription is already CANCELLED');
      },
    });

    await expect(engine.handleWebhook(deletedEvent as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(webhookEvent.upsert).not.toHaveBeenCalled();
  });

  it('should converge a CAS-conflict loser that finds the expected final state', async () => {
    const failedEvent = {
      id: 'evt-fail-3',
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_2', attempt_count: 2 } },
    };
    const { engine, webhookEvent } = makeConvergenceEngine({
      invoiceFindFirst: { ...invoiceRow, id: 'inv-2' },
      findByCompanyImpl: async () => pastDueSub,
      transitionImpl: async () => {
        throw new ConflictException(
          'Subscription was modified by another user.',
        );
      },
    });

    const result = await engine.handleWebhook(failedEvent as any);

    expect(result).toEqual({
      handled: true,
      eventType: 'invoice.payment_failed',
    });
    expect(webhookEvent.upsert).toHaveBeenCalledTimes(1);
  });

  it('should never swallow NotFoundException or unexpected errors', async () => {
    const { engine, webhookEvent } = makeConvergenceEngine({
      invoiceFindFirst: { ...invoiceRow, id: 'inv-2' },
      findByCompanyImpl: async () => {
        throw new NotFoundException('Subscription not found');
      },
      transitionImpl: async () => {
        throw new BadRequestException('Cannot transition from X to PAST_DUE');
      },
    });
    const failedEvent = {
      id: 'evt-fail-4',
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_2', attempt_count: 1 } },
    };

    // Read failure inside verification → original error preserved.
    await expect(engine.handleWebhook(failedEvent as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(webhookEvent.upsert).not.toHaveBeenCalled();

    const { engine: engine2, webhookEvent: upsert2 } = makeConvergenceEngine({
      invoiceFindFirst: { ...invoiceRow },
      markPaidImpl: async () => {
        throw new NotFoundException('Invoice inv-1 not found');
      },
    });
    await expect(engine2.handleWebhook(paidEvent as any)).rejects.toThrow(
      NotFoundException,
    );
    expect(upsert2.upsert).not.toHaveBeenCalled();
  });

  it('should converge a checkout retry and still store provider references', async () => {
    const checkoutEvent = {
      id: 'evt-co-1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          customer: 'cus_1',
          subscription: 'sub_prov_9',
          metadata: { companyId: 'comp-1', planCode: 'starter' },
        },
      },
    };
    let reads = 0;
    const {
      engine,
      companySubscriptionService,
      subscriptionRepository,
      webhookEvent,
    } = makeConvergenceEngine({
      findByCompanyImpl: async () =>
        ++reads === 1 ? pastDueSub : activeSub,
      transitionImpl: async () => {
        throw new BadRequestException(
          'Cannot transition from ACTIVE to ACTIVE',
        );
      },
    });

    const result = await engine.handleWebhook(checkoutEvent as any);

    expect(result).toEqual({
      handled: true,
      eventType: 'checkout.session.completed',
    });
    // Trailing provider-ref write still completed on the converged path.
    expect(subscriptionRepository.updateByCompany).toHaveBeenCalledWith(
      'comp-1',
      expect.objectContaining({ providerCustomerId: 'cus_1' }),
    );
    expect(webhookEvent.upsert).toHaveBeenCalledTimes(1);
    expect(companySubscriptionService.transitionStatus).toHaveBeenCalledTimes(1);
  });

  it('should converge a subscription.updated retry already at the target state', async () => {
    const updatedEvent = {
      id: 'evt-upd-1',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_prov_1', status: 'active' } },
    };
    const { engine, webhookEvent } = makeConvergenceEngine({
      findManySubs: [{ id: 'sub-1', companyId: 'comp-1', status: 'PAST_DUE' }],
      findByCompanyImpl: async () => activeSub,
      transitionImpl: async () => {
        throw new BadRequestException(
          'Cannot transition from ACTIVE to ACTIVE',
        );
      },
    });

    const result = await engine.handleWebhook(updatedEvent as any);

    expect(result).toEqual({
      handled: true,
      eventType: 'customer.subscription.updated',
    });
    expect(webhookEvent.upsert).toHaveBeenCalledTimes(1);
  });
});
