import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';

interface WindowRecord {
  count: number;
  windowStart: number;
}

/**
 * Per-IP fixed-window rate limiter for the registration endpoint.
 *
 * Registration is rare for legitimate users (typically once per organization),
 * so a low ceiling is harmless to real traffic but stops an attacker from
 * bulk-probing emails to enumerate which accounts exist.
 *
 * NOTE: state is in-memory and therefore per-instance. Behind a load balancer
 * with multiple replicas, move this to a shared store (e.g. Redis) for a global
 * limit. Requires `trust proxy` to be configured so `req.ip` is the real client.
 */
@Injectable()
export class RegisterRateLimiter implements OnModuleDestroy {
  private readonly logger = new Logger(RegisterRateLimiter.name);
  private readonly attempts = new Map<string, WindowRecord>();
  private readonly maxAttempts = 10;
  private readonly windowMs = 15 * 60 * 1000;
  private readonly cleanupIntervalMs = 30 * 60 * 1000;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
    // Don't keep the event loop alive solely for cleanup.
    this.cleanupTimer.unref?.();
  }

  /** Throws HTTP 429 when the caller has exceeded the per-IP window. */
  assertWithinLimit(ip: string): void {
    if (!this.consume(ip)) {
      throw new HttpException(
        'Too many registration attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private consume(ip: string): boolean {
    const key = ip || 'unknown';
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record || now - record.windowStart >= this.windowMs) {
      this.attempts.set(key, { count: 1, windowStart: now });
      return true;
    }

    record.count += 1;

    if (record.count > this.maxAttempts) {
      if (record.count === this.maxAttempts + 1) {
        this.logger.warn(`Registration rate limit exceeded for ${key}`);
      }
      return false;
    }

    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.attempts) {
      if (now - record.windowStart >= this.windowMs) {
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
