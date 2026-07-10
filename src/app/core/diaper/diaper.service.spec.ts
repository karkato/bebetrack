import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { DiaperService } from './diaper.service';
import { SupabaseService } from '../supabase.service';
import { SessionService } from '../auth/session.service';
import { BabyService } from '../baby/baby.service';
import { RealtimeService } from '../realtime/realtime.service';
import { Diaper } from './diaper.models';
import { Baby } from '../baby/baby.models';
import { MOCK_BABY, MOCK_BABY_B } from '../baby/testing/baby-fixtures';
import { makeSessionMock } from '../auth/testing/session-mock';
import { makeRealtimeMock, makeCapturingRealtimeMock } from '../realtime/testing/realtime-mock';

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

function makeBabyMock(baby: Baby | null) {
  const babySignal = signal(baby);
  return {
    _signal: babySignal,
    currentBaby: babySignal.asReadonly(),
  } as unknown as BabyService & { _signal: ReturnType<typeof signal<Baby | null>> };
}

// ── existing mutation tests ────────────────────────────────────────────────────

describe('DiaperService', () => {
  describe('createDiaper — passe created_by depuis la session', () => {
    afterEach(() => TestBed.resetTestingModule());

    it('insère avec le bon userId et le bon kind', async () => {
      const mock = makeSupabaseMock();
      const sessionMock = makeSessionMock('user-42');
      const babyMock = makeBabyMock(null);
      const { mock: realtimeMock } = makeRealtimeMock();

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: mock },
          { provide: SessionService, useValue: sessionMock },
          { provide: BabyService, useValue: babyMock },
          { provide: RealtimeService, useValue: realtimeMock },
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
      const babyMock = makeBabyMock(null);
      const { mock: realtimeMock } = makeRealtimeMock();

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: mock },
          { provide: SessionService, useValue: sessionMock },
          { provide: BabyService, useValue: babyMock },
          { provide: RealtimeService, useValue: realtimeMock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(DiaperService);
      await expect(svc.createDiaper('b-1', 'wet')).rejects.toThrow('Not authenticated');
    });
  });

  describe('deleteDiaper — appelle delete avec le bon id', () => {
    afterEach(() => TestBed.resetTestingModule());

    it('supprime la couche par id', async () => {
      const mock = makeSupabaseMock();
      const sessionMock = makeSessionMock('user-42');
      const babyMock = makeBabyMock(null);
      const { mock: realtimeMock } = makeRealtimeMock();

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: mock },
          { provide: SessionService, useValue: sessionMock },
          { provide: BabyService, useValue: babyMock },
          { provide: RealtimeService, useValue: realtimeMock },
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

// ── Realtime tests ────────────────────────────────────────────────────────────

describe('DiaperService — Realtime subscription', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('diaperInvalidated commence à 0', async () => {
    const mock = makeSupabaseMock();
    const sessionMock = makeSessionMock('user-1');
    const babyMock = makeBabyMock(null);
    const { mock: realtimeMock } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
        { provide: SessionService, useValue: sessionMock },
        { provide: BabyService, useValue: babyMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    const svc = TestBed.inject(DiaperService);
    expect(svc.diaperInvalidated()).toBe(0);
  });

  it('un event Realtime incrémente diaperInvalidated', async () => {
    const mock = makeSupabaseMock();
    const sessionMock = makeSessionMock('user-1');
    const babyMock = makeBabyMock(MOCK_BABY);
    const { mock: realtimeMock, holder } = makeCapturingRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
        { provide: SessionService, useValue: sessionMock },
        { provide: BabyService, useValue: babyMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    const svc = TestBed.inject(DiaperService);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(svc.diaperInvalidated()).toBe(0);
    holder.cb?.();
    expect(svc.diaperInvalidated()).toBe(1);
    holder.cb?.();
    expect(svc.diaperInvalidated()).toBe(2);
  });

  it('appelle subscribe() avec table diapers et le bon filtre', async () => {
    const mock = makeSupabaseMock();
    const sessionMock = makeSessionMock('user-1');
    const babyMock = makeBabyMock(MOCK_BABY);
    const { mock: realtimeMock, subscribeFn } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
        { provide: SessionService, useValue: sessionMock },
        { provide: BabyService, useValue: babyMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    TestBed.inject(DiaperService);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(subscribeFn).toHaveBeenCalledWith(
      'diapers-baby-b-1',
      'diapers',
      'baby_id=eq.b-1',
      expect.any(Function),
    );
  });

  // S3: re-subscribe when currentBaby changes from A to B
  it('re-souscrit quand currentBaby change de A vers B', async () => {
    const mock = makeSupabaseMock();
    const sessionMock = makeSessionMock('user-1');
    const babyMock = makeBabyMock(MOCK_BABY);
    const { mock: realtimeMock, subscribeFn, unsubscribeFn } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
        { provide: SessionService, useValue: sessionMock },
        { provide: BabyService, useValue: babyMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    TestBed.inject(DiaperService);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(subscribeFn).toHaveBeenCalledTimes(1);
    expect(subscribeFn).toHaveBeenCalledWith(
      `diapers-baby-${MOCK_BABY.id}`,
      'diapers',
      `baby_id=eq.${MOCK_BABY.id}`,
      expect.any(Function),
    );

    // Switch to baby B
    (babyMock as unknown as { _signal: ReturnType<typeof signal<Baby | null>> })._signal.set(MOCK_BABY_B);
    await new Promise(resolve => setTimeout(resolve, 10));

    // Previous subscription must have been cleaned up
    expect(unsubscribeFn).toHaveBeenCalledTimes(1);
    // New subscription for baby B must have been created
    expect(subscribeFn).toHaveBeenCalledTimes(2);
    expect(subscribeFn).toHaveBeenLastCalledWith(
      `diapers-baby-${MOCK_BABY_B.id}`,
      'diapers',
      `baby_id=eq.${MOCK_BABY_B.id}`,
      expect.any(Function),
    );
  });

  it('appelle unsubscribe() quand currentBaby passe à null', async () => {
    const mock = makeSupabaseMock();
    const sessionMock = makeSessionMock('user-1');
    const babyMock = makeBabyMock(MOCK_BABY);
    const { mock: realtimeMock, unsubscribeFn } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
        { provide: SessionService, useValue: sessionMock },
        { provide: BabyService, useValue: babyMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    TestBed.inject(DiaperService);
    await new Promise(resolve => setTimeout(resolve, 0));

    // Change baby to null — triggers effect cleanup
    (babyMock as unknown as { _signal: ReturnType<typeof signal<Baby | null>> })._signal.set(null);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(unsubscribeFn).toHaveBeenCalled();
  });
});
