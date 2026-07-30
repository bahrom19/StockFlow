import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  /** Secret used to sign access tokens */
  secret: string;
  /** Token expiration string (e.g. "15m", "1h") */
  expiresIn: string;
  /**
   * Secret used to sign refresh tokens.
   * Falls back to `secret` when JWT_REFRESH_SECRET is not set.
   * For production, always set JWT_REFRESH_SECRET to a different value.
   */
  refreshSecret: string;
  /** Refresh token expiration string (e.g. "7d", "30d") */
  refreshExpiresIn: string;
}

export const jwtConfig = registerAs('jwt', (): JwtConfig => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN;
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN;

  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  if (!expiresIn) {
    throw new Error('JWT_EXPIRES_IN is required');
  }
  if (!refreshExpiresIn) {
    throw new Error('JWT_REFRESH_EXPIRES_IN is required');
  }

  return {
    secret,
    expiresIn,
    refreshSecret: process.env.JWT_REFRESH_SECRET || secret,
    refreshExpiresIn,
  };
});
