import type { JwtSignOptions } from '@nestjs/jwt';

const secret = process.env.JWT_SECRET;

// Known placeholder/example values that must never be used in a real deploy.
const PLACEHOLDER_SECRETS = [
  'change-me-generate-with-openssl-rand-hex-32',
  'env-project-dev-secret',
];

// Fail fast instead of silently falling back to a public, committed default.
// A weak/known JWT secret lets anyone forge tokens for any user (incl. superadmin).
if (!secret || secret.length < 32 || PLACEHOLDER_SECRETS.includes(secret)) {
  throw new Error(
    'JWT_SECRET must be set to a strong, random value of at least 32 characters ' +
      '(not the .env.example placeholder). Generate one with: `openssl rand -hex 32`.',
  );
}

export const jwtConstants: { secret: string; expiresIn: JwtSignOptions['expiresIn'] } = {
  secret,
  // 8-hour sessions per spec; the frontend silently refreshes on activity.
  expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as JwtSignOptions['expiresIn'],
};
