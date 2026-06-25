'use client';

import { useEffect, useRef } from 'react';
import { authStorage, refreshSession } from '../lib/auth-client';

// Refresh the 8h token after this much elapsed time, but only while the user is
// active. Idle sessions are left to expire naturally.
const REFRESH_AFTER_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_THROTTLE_MS = 60 * 1000; // don't evaluate more than once a minute

/**
 * Mounted once at the app root. Listens for user activity and silently swaps the
 * stored access token for a fresh one when it's getting old, so active users are
 * never logged out mid-session (per the "JWT silent refresh on activity" spec).
 */
export function SessionRefresher() {
  const lastCheck = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    async function maybeRefresh() {
      const now = Date.now();
      if (now - lastCheck.current < CHECK_THROTTLE_MS) return;
      lastCheck.current = now;

      const token = localStorage.getItem(authStorage.tokenKey);
      if (!token || inFlight.current) return;

      const refreshedAtRaw = localStorage.getItem(authStorage.refreshedAtKey);
      if (!refreshedAtRaw) {
        // First time we've seen this token (e.g. just logged in): treat as fresh.
        localStorage.setItem(authStorage.refreshedAtKey, String(now));
        return;
      }

      if (now - Number(refreshedAtRaw) < REFRESH_AFTER_MS) return;

      inFlight.current = true;
      try {
        const res = await refreshSession(token);
        localStorage.setItem(authStorage.tokenKey, res.accessToken);
        localStorage.setItem(authStorage.userKey, JSON.stringify(res.user));
        localStorage.setItem(authStorage.refreshedAtKey, String(now));
      } catch {
        // Token already invalid/expired — leave storage untouched; the next
        // guarded action will redirect to login.
      } finally {
        inFlight.current = false;
      }
    }

    const handler = () => {
      void maybeRefresh();
    };
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'visibilitychange'];
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    void maybeRefresh();

    return () => events.forEach((e) => window.removeEventListener(e, handler));
  }, []);

  return null;
}
