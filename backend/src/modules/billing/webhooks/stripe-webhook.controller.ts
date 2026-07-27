import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebhookEngineService } from './webhook-engine.service';
import { Request } from 'express';

/**
 * Stripe webhook endpoint.
 *
 * Uses @Req() with RawBodyRequest to access the raw request body
 * for signature verification.
 */
@ApiTags('billing / webhooks')
@Controller('billing/webhooks')
export class StripeWebhookController {
  constructor(private readonly webhookEngine: WebhookEngineService) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Hidden from Swagger (internal webhook)
  @ApiOperation({ summary: 'Stripe webhook endpoint (internal)' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    // Verify signature
    if (signature) {
      const rawBody = req.rawBody?.toString() ?? JSON.stringify(req.body);
      const isValid = this.webhookEngine.verifySignature(rawBody, signature);
      if (!isValid) {
        return { received: false };
      }
    }

    // Process the event
    const payload = req.body;
    await this.webhookEngine.handleWebhook(payload);

    return { received: true };
  }
}
