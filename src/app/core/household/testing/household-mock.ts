import { signal } from '@angular/core';
import type { HouseholdService } from '../household.service';
import type { Household } from '../household.models';

export const MOCK_HOUSEHOLD: Household = {
  id: 'hh-1',
  name: 'Famille Test',
  created_at: '2026-01-01T00:00:00Z',
};

export function makeHouseholdMock(household: Household | null = MOCK_HOUSEHOLD) {
  const householdSignal = signal(household);
  return { household: householdSignal.asReadonly() } as unknown as HouseholdService;
}
