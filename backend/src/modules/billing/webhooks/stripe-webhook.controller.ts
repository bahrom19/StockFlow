import {
  BadRequestException,
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
    // G13-03-08-01: fail-closed authentication gate. A missing or invalid
    // signature rejects the request BEFORE the payload reaches the engine,
    // so forged webhooks can never drive billing state transitions.
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(req.body);
    const isValid = this.webhookEngine.verifySignature(rawBody, signature);
    if (!isValid) {
      throw new BadRequestException('Invalid stripe-signature');
    }

    // Process the event
    const payload = req.body;
    await this.webhookEngine.handleWebhook(payload);

    return { received: true };
  }
}
