import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  secret: string;
  expiresIn: string;
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
    refreshExpiresIn,
  };
});
