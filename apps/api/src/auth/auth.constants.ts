import type { JwtSignOptions } from '@nestjs/jwt';

const secret = process.env.JWT_SECRET;

// Fail fast instead of silently falling back to a public, committed default.
// A weak/known JWT secret lets anyone forge tokens for any user (incl. superadmin).
if (!secret || secret.length < 32) {
  throw new Error(
    'JWT_SECRET must be set to a strong, random value of at least 32 characters. ' +
      'Generate one with: `openssl rand -hex 32` (or `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"`).',
  );
}

export const jwtConstants: { secret: string; expiresIn: JwtSignOptions['expiresIn'] } = {
  secret,
  // 8-hour sessions per spec; the frontend silently refreshes on activity.
  expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as JwtSignOptions['expiresIn'],
};
