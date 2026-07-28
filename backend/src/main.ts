import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { initTracing } from './common/observability/tracing';

async function bootstrap(): Promise<void> {
  // Initialize OpenTelemetry BEFORE creating the app
  initTracing();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const isProduction =
    configService.get<string>('app.nodeEnv') === 'production';

  // Security
  app.enableCors({
    origin: isProduction
      ? configService.get<string>('app.corsOrigin', '*')
      : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });

  app.setGlobalPrefix('api');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Observability
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginEmbedderPolicy: isProduction ? undefined : false,
    }),
  );
  app.use(compression());
  app.enableShutdownHooks();

  // ── API version endpoint ────────────────────────────────────
  // Responds at GET /api/v1 — used by Railway for deploy verification
  app.getHttpAdapter().get('/api/v1', (_req, res) => {
    res.json({
      version: '1.0.0',
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  const port = configService.get<number>('app.port', 3000);

  // Swagger
  if (!isProduction || configService.get<boolean>('app.swaggerEnabled', true)) {
    const config = new DocumentBuilder()
      .setTitle('StockFlow API')
      .setDescription(
        'Production-ready foundation for the StockFlow Enterprise backend',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port);
  Logger.log(`Application is running on: ${await app.getUrl()}`);
  Logger.log(`Swagger docs: ${await app.getUrl()}/docs`);
  Logger.log(`Health check: ${await app.getUrl()}/api/health`);
  Logger.log(`Metrics: ${await app.getUrl()}/api/health/metrics`);
}

void bootstrap();
