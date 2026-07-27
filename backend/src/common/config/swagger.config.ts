import { registerAs } from '@nestjs/config';

export interface SwaggerConfig {
  enabled: boolean;
}

export const swaggerConfig = registerAs('swagger', (): SwaggerConfig => {
  const swaggerEnabled = process.env.SWAGGER_ENABLED;

  return {
    enabled:
      swaggerEnabled === undefined
        ? true
        : swaggerEnabled === 'true' || swaggerEnabled === '1',
  };
});
