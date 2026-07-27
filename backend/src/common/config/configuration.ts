import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { jwtConfig } from './jwt.config';
import { redisConfig } from './redis.config';
import { swaggerConfig } from './swagger.config';

const configuration = [
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  swaggerConfig,
];

export default configuration;
