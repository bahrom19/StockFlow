import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { LogoutDto } from '../dto/logout.dto';
import { AuthUser } from '../interfaces/auth-response.interface';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Per-route rate limit for auth endpoints, applied by the global
 * `ThrottlerGuard` and keyed by IP (plus the existing per-account lockout in
 * `AuthService`).
 *
 * `ThrottlerGuard` evaluates EVERY bucket registered in
 * `ThrottlerModule.forRoot()` against EVERY route, and a route may only
 * override the buckets by name. A previous `@Throttle({ default: ... })` wrote
 * metadata under the key `THROTTLER:LIMITdefault`, while the application
 * registers `short`, `medium`, `long`, `ai-minute` and `ai-hour` — so the
 * decorator was inert and `login` was in practice capped only by
 * `long` (200/min).
 *
 * All three global buckets are therefore overridden here with the same numeric
 * limit but different windows (1s / 10s / 60s), so any of the three may be the
 * one that blocks: a burst inside a single second trips `short`, while a
 * steadier stream trips the 60s `long` bucket. Either way the intended
 * per-minute ceiling is what gets enforced.
 *
 * Per-minute limits are sized from the measured E2E profile on a single IP
 * (login peak 6/min, register 2/min, dev-reset-token 2/min) with headroom, so
 * the suite is never throttled and no CI-specific bypass is required.
 *
 * Over the limit the guard responds 429 and reports which bucket blocked via
 * the suffixed header `Retry-After-<bucket>`; the library does not emit a bare
 * `Retry-After` header.
 */
function AuthThrottle(perMinute: number): MethodDecorator {
  return Throttle({
    short: { limit: perMinute, ttl: 1000 },
    medium: { limit: perMinute, ttl: 10000 },
    long: { limit: perMinute, ttl: 60000 },
  });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @AuthThrottle(5)
  @ApiOperation({ summary: 'Register a new user and company' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @AuthThrottle(20)
  @ApiOperation({ summary: 'Log in a user' })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  @AuthThrottle(5)
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({ status: 200, description: 'Generic success message' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @AuthThrottle(10)
  @ApiOperation({ summary: 'Reset password using a valid token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }

  @Post('dev-reset-token')
  @HttpCode(200)
  @AuthThrottle(10)
  @ApiOperation({ summary: 'DEV ONLY — get raw reset token for testing' })
  @ApiResponse({ status: 200, description: 'Raw reset token (dev only)' })
  async devGetResetToken(@Body() forgotPasswordDto: ForgotPasswordDto) {
    if (this.configService.get<string>('app.nodeEnv') === 'production') {
      throw new Error('Not available in production');
    }
    return this.authService.devGetResetToken(forgotPasswordDto.email);
  }

  @Post('refresh')
  @AuthThrottle(30)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }

  @Post('logout')
  @AuthThrottle(30)
  @ApiOperation({ summary: 'Invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Body() logoutDto: LogoutDto) {
    return this.authService.logout(logoutDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile (roles + permissions)' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: Object,
  })
  async getProfile(@CurrentUser() user: JwtPayload): Promise<AuthUser> {
    return this.authService.getProfile(user.userId, user.companyId);
  }
}
