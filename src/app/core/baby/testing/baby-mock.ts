import { signal } from '@angular/core';
import type { Baby } from '../baby.models';
import type { BabyService } from '../baby.service';

export function makeBabyMock(baby: Baby | null) {
  const babySignal = signal(baby);
  return {
    _signal: babySignal,
    currentBaby: babySignal.asReadonly(),
  } as unknown as BabyService & { _signal: ReturnType<typeof signal<Baby | null>> };
}
