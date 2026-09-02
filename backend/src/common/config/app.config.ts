import { registerAs } from '@nestjs/config';

export type NodeEnvironment = 'development' | 'production' | 'test';

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  url: string;
  swaggerEnabled: boolean;
}

export const appConfig = registerAs('app', (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const swaggerEnabled = process.env.SWAGGER_ENABLED;

  const url = process.env.APP_URL ?? 'http://localhost:3001';

  return {
    nodeEnv: nodeEnv as NodeEnvironment,
    port: Number.isNaN(port) ? 3000 : port,
    url,
    swaggerEnabled:
      swaggerEnabled === undefined
        ? false
        : swaggerEnabled === 'true' || swaggerEnabled === '1',
  };
});
