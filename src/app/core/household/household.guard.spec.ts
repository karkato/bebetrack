import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { householdGuard } from './household.guard';
import { HouseholdService } from './household.service';

function makeHouseholdServiceMock(hasHousehold: boolean) {
  return {
    hasHousehold: signal(hasHousehold),
  } as unknown as HouseholdService;
}

describe('householdGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  it('returns true when household exists', () => {
    TestBed.overrideProvider(HouseholdService, {
      useValue: makeHouseholdServiceMock(true),
    });

    const result = TestBed.runInInjectionContext(() => householdGuard({} as never, [], null as never));

    expect(result).toBe(true);
  });

  it('redirects to /onboarding when no household', () => {
    TestBed.overrideProvider(HouseholdService, {
      useValue: makeHouseholdServiceMock(false),
    });

    const result = TestBed.runInInjectionContext(() => householdGuard({} as never, [], null as never)) as UrlTree;
    const router = TestBed.inject(Router);

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result)).toBe('/onboarding');
  });
});
