import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService, HealthStatus } from './health.service';
import { MetricsService } from '../../common/observability/metrics.service';

@SkipThrottle()
@Controller('health')
@ApiTags('Health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy.' })
  async getHealth(): Promise<HealthStatus> {
    return this.healthService.fullHealth();
  }

  @Get('live')
  @ApiOperation({ summary: 'Kubernetes liveness probe' })
  @ApiResponse({ status: 200, description: 'Process is alive.' })
  async liveness(): Promise<HealthStatus> {
    return this.healthService.liveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Kubernetes readiness probe' })
  @ApiResponse({
    status: 200,
    description: 'Service is ready to serve traffic.',
  })
  async readiness(): Promise<HealthStatus> {
    return this.healthService.readiness();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Prometheus metrics endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics in exposition format.',
  })
  async getMetrics(): Promise<string> {
    return this.metricsService.metrics();
  }
}
