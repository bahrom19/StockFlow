import { registerAs } from '@nestjs/config';

export type NodeEnvironment = 'development' | 'production' | 'test';

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  swaggerEnabled: boolean;
}

export const appConfig = registerAs('app', (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const swaggerEnabled = process.env.SWAGGER_ENABLED;

  return {
    nodeEnv: nodeEnv as NodeEnvironment,
    port: Number.isNaN(port) ? 3000 : port,
    swaggerEnabled:
      swaggerEnabled === undefined
        ? true
        : swaggerEnabled === 'true' || swaggerEnabled === '1',
  };
});
