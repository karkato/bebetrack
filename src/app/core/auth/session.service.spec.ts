import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionService } from './session.service';
import { SupabaseService } from '../supabase.service';

function makeSupabaseMock() {
  const authStateCallback = vi.fn();
  const signInWithPassword = vi.fn();
  const signOut = vi.fn().mockResolvedValue({});
  const getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });

  return {
    client: {
      auth: {
        onAuthStateChange: (cb: (...args: unknown[]) => void) => {
          authStateCallback.mockImplementation(cb);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
        getSession,
        signInWithPassword,
        signOut,
      },
    },
    _authStateCallback: authStateCallback,
    _signIn: signInWithPassword,
  };
}

describe('SessionService', () => {
  let supabaseMock: ReturnType<typeof makeSupabaseMock>;

  beforeEach(() => {
    supabaseMock = makeSupabaseMock();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    });
  });

  it('isAuthenticated() is false before initialization', () => {
    const service = TestBed.inject(SessionService);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('initialize() sets session from getSession', async () => {
    const mockSession = { user: { id: 'u1', email: 'a@b.com' }, access_token: 'tok' };
    supabaseMock.client.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const service = TestBed.inject(SessionService);
    await service.initialize();

    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.id).toBe('u1');
  });

  it('signIn() throws when Supabase returns an error', async () => {
    supabaseMock._signIn.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' },
    });
    supabaseMock.client.auth.signInWithPassword = supabaseMock._signIn;

    const service = TestBed.inject(SessionService);

    await expect(service.signIn('a@b.com', 'wrong')).rejects.toMatchObject({
      message: 'Invalid credentials',
    });
  });
});
