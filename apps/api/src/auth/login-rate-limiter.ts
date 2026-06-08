import { Injectable, Logger } from '@nestjs/common';

interface AttemptRecord {
  failCount: number;
  lockedUntil: number | null;
}

@Injectable()
export class LoginRateLimiter {
  private readonly logger = new Logger(LoginRateLimiter.name);
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly maxAttempts = 5;
  private readonly lockoutMs = 15 * 60 * 1000;
  private readonly cleanupIntervalMs = 30 * 60 * 1000;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
  }

  isLocked(email: string): boolean {
    const key = email.toLowerCase();
    const record = this.attempts.get(key);

    if (!record?.lockedUntil) {
      return false;
    }

    if (Date.now() >= record.lockedUntil) {
      this.attempts.delete(key);
      return false;
    }

    return true;
  }

  recordFailure(email: string): void {
    const key = email.toLowerCase();
    const record = this.attempts.get(key) ?? { failCount: 0, lockedUntil: null };

    record.failCount += 1;

    if (record.failCount >= this.maxAttempts) {
      record.lockedUntil = Date.now() + this.lockoutMs;
      this.logger.warn(`Login locked for ${key} after ${record.failCount} failed attempts`);
    }

    this.attempts.set(key, record);
  }

  recordSuccess(email: string): void {
    this.attempts.delete(email.toLowerCase());
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [key, record] of this.attempts) {
      if (record.lockedUntil && now >= record.lockedUntil) {
        this.attempts.delete(key);
      }
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
