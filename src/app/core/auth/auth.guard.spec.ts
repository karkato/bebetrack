import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { authGuard } from './auth.guard';
import { SessionService } from './session.service';

function makeSessionServiceMock(authenticated: boolean) {
  return {
    isAuthenticated: signal(authenticated),
  } as unknown as SessionService;
}

describe('authGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  it('returns true when the session is authenticated', () => {
    TestBed.overrideProvider(SessionService, {
      useValue: makeSessionServiceMock(true),
    });

    const result = TestBed.runInInjectionContext(() =>
      authGuard({ path: '' } as never, [{ path: 'dashboard' } as never], null as never),
    );

    expect(result).toBe(true);
  });

  it('redirects to /login with redirect query param when not authenticated', () => {
    TestBed.overrideProvider(SessionService, {
      useValue: makeSessionServiceMock(false),
    });

    const result = TestBed.runInInjectionContext(() =>
      authGuard({ path: '' } as never, [{ path: 'dashboard' } as never], null as never),
    ) as UrlTree;

    const router = TestBed.inject(Router);
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result)).toContain('/login');
    expect(router.serializeUrl(result)).toContain('redirect');
  });
});
