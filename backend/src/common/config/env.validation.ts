import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().optional().allow(''),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).optional(),
  JWT_EXPIRES_IN: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().required(),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),

  // AI Configuration
  AI_PROVIDER: Joi.string().valid('openai').default('openai'),
  AI_API_KEY: Joi.string().min(10).optional().allow(''),
  AI_MODEL: Joi.string().optional().default('gpt-4o-mini'),
  AI_TEMPERATURE: Joi.number().min(0).max(2).optional().default(0.7),
  AI_MAX_TOKENS: Joi.number().min(1).max(8192).optional().default(2048),
  AI_TIMEOUT_MS: Joi.number().min(1000).max(120000).optional().default(30000),
  AI_REQUEST_TIMEOUT_MS: Joi.number().min(60000).max(300000).optional().default(120000),
}).required();
