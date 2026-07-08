import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HouseholdService } from './household.service';
import { SessionService } from '../auth/session.service';
import { SupabaseService } from '../supabase.service';
import type { Household } from './household.models';

const mockHousehold: Household = { id: 'h1', name: 'Famille Test', created_at: '2026-01-01T00:00:00Z' };

function makeSupabaseMock() {
  const rpc = vi.fn();
  const maybeSingle = vi.fn();
  const limit = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ select }));

  return { client: { from, rpc } };
}

function makeSessionMock(authenticated = true) {
  return { isAuthenticated: signal(authenticated) } as unknown as SessionService;
}

describe('HouseholdService', () => {
  let supabaseMock: ReturnType<typeof makeSupabaseMock>;

  beforeEach(() => {
    supabaseMock = makeSupabaseMock();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: SessionService, useValue: makeSessionMock(true) },
      ],
    });
  });

  it('hasHousehold() is false initially', () => {
    const service = TestBed.inject(HouseholdService);
    expect(service.hasHousehold()).toBe(false);
  });

  it('initialize() loads household when authenticated', async () => {
    supabaseMock.client.from().select().limit().maybeSingle.mockResolvedValue({
      data: mockHousehold,
      error: null,
    });

    const service = TestBed.inject(HouseholdService);
    await service.initialize();

    expect(service.hasHousehold()).toBe(true);
    expect(service.household()?.id).toBe('h1');
  });

  it('initialize() does nothing when not authenticated', async () => {
    TestBed.overrideProvider(SessionService, { useValue: makeSessionMock(false) });

    const service = TestBed.inject(HouseholdService);
    await service.initialize();

    expect(service.hasHousehold()).toBe(false);
    expect(supabaseMock.client.from).not.toHaveBeenCalled();
  });

  it('createHousehold() calls RPC and updates the signal', async () => {
    supabaseMock.client.rpc.mockResolvedValue({ data: 'h2', error: null });
    supabaseMock.client.from().select().limit().maybeSingle.mockResolvedValue({
      data: { ...mockHousehold, id: 'h2' },
      error: null,
    });

    const service = TestBed.inject(HouseholdService);
    const id = await service.createHousehold('Famille Test');

    expect(supabaseMock.client.rpc).toHaveBeenCalledWith('create_household', {
      household_name: 'Famille Test',
    });
    expect(id).toBe('h2');
    expect(service.hasHousehold()).toBe(true);
  });

  it('createHousehold() throws when RPC returns an error', async () => {
    supabaseMock.client.rpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } });

    const service = TestBed.inject(HouseholdService);

    await expect(service.createHousehold('Test')).rejects.toMatchObject({ message: 'RPC error' });
  });
});
