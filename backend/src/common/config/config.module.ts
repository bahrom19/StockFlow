import { ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { envValidationSchema } from './env.validation';

export const AppConfigModule = NestConfigModule.forRoot({
  isGlobal: true,
  envFilePath: ['.env.local', '.env'],
  load: configuration,
  validationSchema: envValidationSchema,
  validationOptions: {
    abortEarly: false,
    allowUnknown: true,
  },
  expandVariables: true,
  cache: true,
});
