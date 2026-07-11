import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { householdGuard } from './core/household/household.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canMatch: [authGuard],
  },
  {
    path: 'join/:token',
    loadComponent: () =>
      import('./features/invite/accept-invite.component').then(m => m.AcceptInviteComponent),
    canMatch: [authGuard],
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then(m => m.HomeComponent),
    canMatch: [authGuard, householdGuard],
  },
  {
    path: 'stock',
    loadComponent: () =>
      import('./features/stock/stock.component').then(m => m.StockComponent),
    canMatch: [authGuard, householdGuard],
  },
  {
    path: 'timeline',
    loadComponent: () =>
      import('./features/timeline/timeline.component').then(m => m.TimelineComponent),
    canMatch: [authGuard, householdGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
