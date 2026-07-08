import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { HouseholdService } from './household.service';

export const householdGuard: CanMatchFn = () => {
  const household = inject(HouseholdService);
  const router = inject(Router);

  if (household.hasHousehold()) {
    return true;
  }

  return router.createUrlTree(['/onboarding']);
};
