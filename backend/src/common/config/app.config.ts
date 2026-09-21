import { registerAs } from '@nestjs/config';

export type NodeEnvironment = 'development' | 'production' | 'test';

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  url: string;
  swaggerEnabled: boolean;
  stripeWebhookSecret: string;
  stripeWebhookSkipVerify: boolean;
}

export const appConfig = registerAs('app', (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const swaggerEnabled = process.env.SWAGGER_ENABLED;

  const url = process.env.APP_URL ?? 'http://localhost:3001';

  // G13-03-08-01: Stripe webhook verification material. The secret stays
  // empty unless explicitly configured; the engine fails closed without it.
  // STRIPE_WEBHOOK_SKIP_VERIFY is an explicit opt-in bypass for local
  // development only — never enable in production.
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  const stripeWebhookSkipVerify =
    process.env.STRIPE_WEBHOOK_SKIP_VERIFY === 'true' ||
    process.env.STRIPE_WEBHOOK_SKIP_VERIFY === '1';

  return {
    nodeEnv: nodeEnv as NodeEnvironment,
    port: Number.isNaN(port) ? 3000 : port,
    url,
    swaggerEnabled:
      swaggerEnabled === undefined
        ? false
        : swaggerEnabled === 'true' || swaggerEnabled === '1',
    stripeWebhookSecret,
    stripeWebhookSkipVerify,
  };
});
