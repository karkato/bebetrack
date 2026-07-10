import { signal } from '@angular/core';
import { vi } from 'vitest';
import type { RealtimeService } from '../realtime.service';

export function makeRealtimeMock() {
  const unsubscribeFn = vi.fn();
  const subscribeFn = vi.fn().mockReturnValue({ unsubscribe: unsubscribeFn });
  return {
    mock: { subscribe: subscribeFn, status: signal('SUBSCRIBED').asReadonly() } as unknown as RealtimeService,
    subscribeFn,
    unsubscribeFn,
  };
}

export function makeCapturingRealtimeMock() {
  const unsubscribeFn = vi.fn();
  const holder: { cb: ((...args: unknown[]) => void) | null } = { cb: null };
  const subscribeFn = vi.fn().mockImplementation(
    (_channelName: string, _table: string, _filter: string, cb: (...args: unknown[]) => void) => {
      holder.cb = cb;
      return { unsubscribe: unsubscribeFn };
    }
  );
  return {
    mock: { subscribe: subscribeFn, status: signal('SUBSCRIBED').asReadonly() } as unknown as RealtimeService,
    subscribeFn,
    unsubscribeFn,
    holder,
  };
}
