import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { jwtConfig } from './jwt.config';
import { platformConfig } from './platform.config';
import { redisConfig } from './redis.config';
import { swaggerConfig } from './swagger.config';

const configuration = [
  appConfig,
  databaseConfig,
  jwtConfig,
  platformConfig,
  redisConfig,
  swaggerConfig,
];

export default configuration;
