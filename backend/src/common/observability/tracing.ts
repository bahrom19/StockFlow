/**
 * OpenTelemetry initialization for StockFlow.
 * Must be imported BEFORE any other module in the application bootstrap.
 *
 * Enables:
 * - Distributed tracing with W3C trace-context propagation
 * - HTTP request tracing (incoming/outgoing)
 * - Express route tracing
 * - Prisma query tracing
 * - OTLP export (compatible with Jaeger, Grafana Tempo, etc.)
 */

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';
const OTEL_EXPORTER_OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces';
const OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? 'stockflow-backend';

let sdk: NodeSDK | null = null;

export function initTracing(): void {
  if (!OTEL_ENABLED) {
    return;
  }

  const traceExporter = new OTLPTraceExporter({
    url: OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: OTEL_SERVICE_NAME,
      'service.version': '1.0.0',
    }),
    spanProcessor: new BatchSpanProcessor(traceExporter),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new PrismaInstrumentation(),
    ],
  });

  sdk.start();
  process.on('SIGTERM', () => {
    shutdownTracing().catch(() => {});
  });
  process.on('SIGINT', () => {
    shutdownTracing().catch(() => {});
  });
}

export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
    } catch {
      // Silently handle shutdown errors
    }
  }
}
