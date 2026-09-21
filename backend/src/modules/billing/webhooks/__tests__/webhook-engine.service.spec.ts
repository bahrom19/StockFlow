import { createHmac } from 'crypto';
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
