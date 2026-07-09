import {
  ApplicationConfig,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { SessionService } from './core/auth/session.service';
import { HouseholdService } from './core/household/household.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(async () => {
      const session = inject(SessionService);
      const household = inject(HouseholdService);
      try {
        await session.initialize();
        await household.initialize();
      } catch (err) {
        console.error('[AppInit] Hydration failed — starting in unauthenticated state', err);
      }
    }),
  ],
};
