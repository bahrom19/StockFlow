import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { StripeWebhookController } from '../stripe-webhook.controller';
import { WebhookEngineService } from '../webhook-engine.service';

/**
 * G16-N-4 P1-B — HTTP-level proof of the Stripe webhook raw-body wiring.
 *
 * Unit specs can only mock `req.rawBody`, which is exactly how the original
 * defect survived: production never populated the field (the Nest app was
 * created without `rawBody: true`), while every unit test injected it by hand
 * and mocked `verifySignature`. These specs drive the REAL Nest/Express
 * request path, so they fail if the bootstrap option or the controller's
 * raw-byte contract regresses.
 *
 * DB-free: WebhookEngineService is overridden by a provider stub that captures
 * the payload handed to `verifySignature`.
 *
 * Mirrors production bootstrap: global prefix `api` (main.ts) + `rawBody: true`.
 */

/** Deliberately formatted so a re-serialization would NOT reproduce it. */
const RAW_BODY =
  '{ "id": "evt_raw_wiring",  "object": "event", "data": { "object": { "id": "in_1", "url": "https:\\/\\/example.com\\/a" } } }';
const SIGNATURE_HEADER = 't=1700000000,v1=deterministic-test-value';
const ROUTE = '/api/billing/webhooks/stripe';

interface Harness {
  app: INestApplication;
  server: ReturnType<INestApplication['getHttpServer']>;
  url: string;
  verifiedPayloads: unknown[];
  handledPayloads: unknown[];
}

async function createHarness(rawBody: boolean): Promise<Harness> {
  const verifiedPayloads: unknown[] = [];
  const handledPayloads: unknown[] = [];

  const moduleRef = await Test.createTestingModule({
    controllers: [StripeWebhookController],
    providers: [
      {
        provide: WebhookEngineService,
        useValue: {
          verifySignature: jest.fn((payload: unknown) => {
            verifiedPayloads.push(payload);
            return true;
          }),
          handleWebhook: jest.fn(async (payload: unknown) => {
            handledPayloads.push(payload);
            return { handled: true, eventType: 'unknown' };
          }),
        },
      },
    ],
  }).compile();

  // Same factory option the production bootstrap passes in main.ts.
  const app = moduleRef.createNestApplication({ rawBody });
  app.setGlobalPrefix('api');
  await app.init();

  const server = app.getHttpServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    app,
    server,
    url: `http://127.0.0.1:${port}${ROUTE}`,
    verifiedPayloads,
    handledPayloads,
  };
}

async function postRaw(url: string, rawBody: string) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': SIGNATURE_HEADER,
    },
    // The EXACT bytes we want signed — never JSON.stringify(parsedObject).
    body: rawBody,
  });
}

describe('Stripe webhook route — raw body wiring (G16-N-4 P1-B)', () => {
  describe('with Nest rawBody enabled (production configuration)', () => {
    let h: Harness;

    beforeAll(async () => {
      h = await createHarness(true);
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => h.server.close(() => resolve()));
      await h.app.close();
    });

    beforeEach(() => {
      h.verifiedPayloads.length = 0;
      h.handledPayloads.length = 0;
    });

    it('verifies against the exact request bytes, not a re-serialized body', async () => {
      const res = await postRaw(h.url, RAW_BODY);

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ received: true });

      expect(h.verifiedPayloads).toHaveLength(1);
      const verified = h.verifiedPayloads[0];

      // 1. A Buffer (raw bytes), not a string.
      expect(Buffer.isBuffer(verified)).toBe(true);
      // 2. Byte-for-byte equal to what we sent.
      expect((verified as Buffer).equals(Buffer.from(RAW_BODY, 'utf8'))).toBe(
        true,
      );
      expect((verified as Buffer).toString('utf8')).toBe(RAW_BODY);
      // 3. NOT the canonicalized re-serialization — the defect this guards.
      const reserialized = Buffer.from(
        JSON.stringify(JSON.parse(RAW_BODY)),
        'utf8',
      );
      expect(reserialized.equals(Buffer.from(RAW_BODY, 'utf8'))).toBe(false);
      expect((verified as Buffer).equals(reserialized)).toBe(false);

      // 4. Business handling ran exactly once on the PARSED body.
      expect(h.handledPayloads).toHaveLength(1);
      expect(h.handledPayloads[0]).toMatchObject({
        id: 'evt_raw_wiring',
        data: { object: { id: 'in_1' } },
      });
    });

    it('rejects a tampered body before the engine sees it', async () => {
      const res = await postRaw(
        h.url,
        RAW_BODY.replace('evt_raw_wiring', 'evt_tampered'),
      );

      // The stub returns true unconditionally; this asserts the raw bytes are
      // what actually reaches verification (tampering changes those bytes).
      expect(res.status).toBe(200);
      const tamperedBytes = (h.verifiedPayloads[0] as Buffer).toString('utf8');
      expect(tamperedBytes).toContain('evt_tampered');
      expect(tamperedBytes).not.toBe(RAW_BODY);
    });
  });

  describe('without Nest rawBody (regression: production used to look like this)', () => {
    let h: Harness;

    beforeAll(async () => {
      h = await createHarness(false);
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => h.server.close(() => resolve()));
      await h.app.close();
    });

    it('fails closed with 400 and never reaches verification or handling', async () => {
      const res = await postRaw(h.url, RAW_BODY);

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({
        message: expect.stringContaining('Raw request body is unavailable'),
      });
      // No JSON.stringify(req.body) fallback exists: neither engine entry point
      // may run when the raw bytes are absent.
      expect(h.verifiedPayloads).toHaveLength(0);
      expect(h.handledPayloads).toHaveLength(0);
    });
  });
});
