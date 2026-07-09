import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DiaperService } from './diaper.service';
import { SupabaseService } from '../supabase.service';
import { SessionService } from '../auth/session.service';
import { Diaper } from './diaper.models';

const MOCK_DIAPER: Diaper = {
  id: 'd-1',
  baby_id: 'b-1',
  at: '2026-01-01T10:00:00Z',
  kind: 'wet',
  created_by: 'user-1',
  created_at: '2026-01-01T10:00:00Z',
};

function makeSupabaseMock(returnedDiaper: Diaper | null = MOCK_DIAPER) {
  const singleFn = vi.fn().mockResolvedValue({ data: returnedDiaper, error: null });
  const selectFn = vi.fn().mockReturnValue({ single: singleFn });
  const insertFn = vi.fn().mockReturnValue({ select: selectFn });
  const eqFn = vi.fn().mockResolvedValue({ data: null, error: null });
  const deleteFn = vi.fn().mockReturnValue({ eq: eqFn });
  return {
    client: {
      from: vi.fn().mockReturnValue({
        insert: insertFn,
        delete: deleteFn,
      }),
    },
    _mocks: { insertFn, selectFn, singleFn, deleteFn, eqFn },
  } as unknown as SupabaseService & { _mocks: Record<string, ReturnType<typeof vi.fn>> };
}

function makeSessionMock(userId: string | null) {
  const userSignal = signal(userId ? { id: userId } : null);
  return {
    user: userSignal.asReadonly(),
  } as unknown as SessionService;
}

describe('DiaperService', () => {
  describe('createDiaper — passe created_by depuis la session', () => {
    it('insère avec le bon userId et le bon kind', async () => {
      const mock = makeSupabaseMock();
      const sessionMock = makeSessionMock('user-42');

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: mock },
          { provide: SessionService, useValue: sessionMock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(DiaperService);
      const result = await svc.createDiaper('b-1', 'dirty');

      expect(mock.client.from).toHaveBeenCalledWith('diapers');
      const insertArg = (mock as unknown as { _mocks: Record<string, ReturnType<typeof vi.fn>> })._mocks['insertFn'].mock.calls[0][0];
      expect(insertArg.baby_id).toBe('b-1');
      expect(insertArg.kind).toBe('dirty');
      expect(insertArg.created_by).toBe('user-42');
      expect(typeof insertArg.at).toBe('string');
      expect(result).toEqual(MOCK_DIAPER);
    });

    it('lève une erreur si non authentifié', async () => {
      const mock = makeSupabaseMock();
      const sessionMock = makeSessionMock(null);

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: mock },
          { provide: SessionService, useValue: sessionMock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(DiaperService);
      await expect(svc.createDiaper('b-1', 'wet')).rejects.toThrow('Not authenticated');
    });
  });

  describe('deleteDiaper — appelle delete avec le bon id', () => {
    it('supprime la couche par id', async () => {
      const mock = makeSupabaseMock();
      const sessionMock = makeSessionMock('user-42');

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: mock },
          { provide: SessionService, useValue: sessionMock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(DiaperService);
      await svc.deleteDiaper('d-99');

      expect(mock.client.from).toHaveBeenCalledWith('diapers');
      const eqFn = (mock as unknown as { _mocks: Record<string, ReturnType<typeof vi.fn>> })._mocks['eqFn'];
      expect(eqFn).toHaveBeenCalledWith('id', 'd-99');
    });
  });
});
