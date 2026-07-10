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

const MOCK_DIAPER: Diaper = {
  id: 'd-1',
  baby_id: 'b-1',
  at: '2026-01-01T10:00:00Z',
  kind: 'wet',
  created_by: 'user-1',
  created_at: '2026-01-01T10:00:00Z',
};

const MOCK_BABY: Baby = {
  id: 'b-1',
  household_id: 'hh-1',
  name: 'Léa',
  birth_date: '2026-01-01',
  feeding_preference: 'mixed',
  created_at: '',
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

function makeBabyMock(baby: Baby | null) {
  const babySignal = signal(baby);
  return {
    _signal: babySignal,
    currentBaby: babySignal.asReadonly(),
  } as unknown as BabyService & { _signal: ReturnType<typeof signal<Baby | null>> };
}

function makeRealtimeMock() {
  const unsubscribeFn = vi.fn();
  const subscribeFn = vi.fn().mockReturnValue({ unsubscribe: unsubscribeFn });
  return {
    mock: {
      subscribe: subscribeFn,
      status: signal('SUBSCRIBED').asReadonly(),
    } as unknown as RealtimeService,
    subscribeFn,
    unsubscribeFn,
  };
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

    let capturedCallback: (() => void) | null = null;
    const unsubscribeFn = vi.fn();
    const subscribeFn = vi.fn().mockImplementation(
      (_name: string, _table: string, _filter: string, cb: () => void) => {
        capturedCallback = cb;
        return { unsubscribe: unsubscribeFn };
      }
    );
    const realtimeMock = {
      subscribe: subscribeFn,
      status: signal('SUBSCRIBED').asReadonly(),
    } as unknown as RealtimeService;

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
    capturedCallback?.();
    expect(svc.diaperInvalidated()).toBe(1);
    capturedCallback?.();
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
