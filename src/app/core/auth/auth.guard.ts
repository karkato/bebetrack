import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlSegment, Route } from '@angular/router';
import { SessionService } from './session.service';

export const authGuard: CanMatchFn = (_route: Route, segments: UrlSegment[]) => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (session.isAuthenticated()) {
    return true;
  }

  const redirectUrl = '/' + segments.map(s => s.path).join('/');
  return router.createUrlTree(['/login'], { queryParams: { redirect: redirectUrl } });
};
