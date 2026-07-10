import { signal } from '@angular/core';
import type { SessionService } from '../session.service';

export function makeSessionMock(userId: string | null) {
  const userSignal = signal(userId ? { id: userId } : null);
  return { user: userSignal.asReadonly() } as unknown as SessionService;
}
