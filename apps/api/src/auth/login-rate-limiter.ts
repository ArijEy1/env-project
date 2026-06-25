import { Injectable, Logger } from '@nestjs/common';

interface AttemptRecord {
  failCount: number;
  lockedUntil: number | null;
}

interface IpWindow {
  count: number;
  windowStart: number;
}

@Injectable()
export class LoginRateLimiter {
  private readonly logger = new Logger(LoginRateLimiter.name);
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly maxAttempts = 5;
  private readonly lockoutMs = 15 * 60 * 1000;
  private readonly cleanupIntervalMs = 30 * 60 * 1000;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  // Per-IP failed-attempt window to blunt password spraying across many emails.
  private readonly ipAttempts = new Map<string, IpWindow>();
  private readonly maxIpAttempts = 50;
  private readonly ipWindowMs = 15 * 60 * 1000;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
    this.cleanupTimer.unref?.();
  }

  isIpThrottled(ip: string): boolean {
    if (!ip) return false;
    const w = this.ipAttempts.get(ip);
    if (!w) return false;
    if (Date.now() - w.windowStart >= this.ipWindowMs) {
      this.ipAttempts.delete(ip);
      return false;
    }
    return w.count >= this.maxIpAttempts;
  }

  recordIpFailure(ip: string): void {
    if (!ip) return;
    const now = Date.now();
    const w = this.ipAttempts.get(ip);
    if (!w || now - w.windowStart >= this.ipWindowMs) {
      this.ipAttempts.set(ip, { count: 1, windowStart: now });
      return;
    }
    w.count += 1;
    if (w.count === this.maxIpAttempts) {
      this.logger.warn(`Login throttled for IP ${ip} after ${w.count} failed attempts`);
    }
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
    for (const [ip, w] of this.ipAttempts) {
      if (now - w.windowStart >= this.ipWindowMs) {
        this.ipAttempts.delete(ip);
      }
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
