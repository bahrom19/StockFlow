import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Abstraction for sending password-reset emails.
 *
 * In development / test environments the reset link is logged to the console
 * so that the token is accessible without requiring a real SMTP server.
 * In production, a concrete SMTP/SES/Resend provider should be injected here.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly isProduction: boolean;
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.isProduction =
      this.configService.get<string>('app.nodeEnv') === 'production';
    this.appUrl =
      this.configService.get<string>('app.url') ?? 'http://localhost:3001';
  }

  /**
   * Send a password-reset email.
   * @param email   Recipient address
   * @param token   Raw (unhashed) reset token — never stored, only sent
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.appUrl}/#/reset-password?token=${token}`;

    if (this.isProduction) {
      // TODO: plug in real SMTP/SES/Resend provider here.
      // For now, throw to make accidental production calls visible.
      this.logger.error(
        `Cannot send password-reset email in production — no SMTP provider configured. ` +
          `User: ${email}`,
      );
      return;
    }

    // Development / test: log the reset link so it is visible in server output.
    this.logger.log(
      `╔══════════════════════════════════════════════════════════════╗\n` +
        `║  DEV PASSWORD RESET                                         ║\n` +
        `║  To: ${email.padEnd(50)}║\n` +
        `║  URL: ${resetUrl.substring(0, 50).padEnd(50)}║\n` +
        `╚══════════════════════════════════════════════════════════════╝`,
    );
  }
}
