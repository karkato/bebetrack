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
import { MOCK_DIAPER } from './testing/diaper-fixtures';
import { makeBabyMock } from '../baby/testing/baby-mock';

function makeSupabaseMock(options?: {
  returnedDiaper?: Diaper | null;
  rpcResult?: { data: unknown; error: Error | null };
}) {
  const returnedDiaper = options?.returnedDiaper ?? MOCK_DIAPER;

  // Refetch chain: from().select('*').eq('id', id).single()
  const refetchSingleFn = vi.fn().mockResolvedValue({ data: returnedDiaper, error: null });
  const refetchEqFn = vi.fn().mockReturnValue({ single: refetchSingleFn });
  const refetchSelectFn = vi.fn().mockReturnValue({ eq: refetchEqFn });

  // Insert fallback chain: from().insert().select().single()
  const insertSingleFn = vi.fn().mockResolvedValue({ data: returnedDiaper, error: null });
  const insertSelectFn = vi.fn().mockReturnValue({ single: insertSingleFn });
  const insertFn = vi.fn().mockReturnValue({ select: insertSelectFn });

  // Delete chain: from().delete().eq()
  const eqFn = vi.fn().mockResolvedValue({ data: null, error: null });
  const deleteFn = vi.fn().mockReturnValue({ eq: eqFn });

  // RPC — default: succeeds and returns diaper_id; tests can override
  const defaultRpcResult = options?.rpcResult ?? {
    data: { diaper_id: returnedDiaper?.id ?? 'd-1' },
    error: null,
  };
  const rpcFn = vi.fn().mockResolvedValue(defaultRpcResult);

  return {
    client: {
      from: vi.fn().mockReturnValue({
        insert: insertFn,
        delete: deleteFn,
        select: refetchSelectFn,
      }),
      rpc: rpcFn,
    },
    _mocks: { insertFn, insertSelectFn, insertSingleFn, deleteFn, eqFn, refetchSelectFn, refetchEqFn, refetchSingleFn, rpcFn },
  } as unknown as SupabaseService & { _mocks: Record<string, ReturnType<typeof vi.fn>> };
}

// ── mutation tests ────────────────────────────────────────────────────────────

describe('DiaperService', () => {
  describe('createDiaper — chemin RPC atomique', () => {
    afterEach(() => TestBed.resetTestingModule());

    it('utilise la RPC et retourne le diaper via refetch', async () => {
      const mock = makeSupabaseMock(); // RPC succeeds by default
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

      const mocks = (mock as unknown as { _mocks: Record<string, ReturnType<typeof vi.fn>> })._mocks;
      expect(mocks['rpcFn']).toHaveBeenCalledWith('record_diaper_with_stock', { p_baby_id: 'b-1', p_kind: 'dirty' });
      // insert NOT called — RPC handled the insert
      expect(mocks['insertFn']).not.toHaveBeenCalled();
      // refetch via from().select().eq().single()
      expect(mocks['refetchEqFn']).toHaveBeenCalledWith('id', MOCK_DIAPER.id);
      expect(result).toEqual(MOCK_DIAPER);
    });

    it('bascule sur l\'insert direct si la RPC retourne une erreur', async () => {
      const mock = makeSupabaseMock({
        rpcResult: { data: null, error: new Error('rpc error') },
      });
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

      const mocks = (mock as unknown as { _mocks: Record<string, ReturnType<typeof vi.fn>> })._mocks;
      // Fallback: insert direct called, refetch NOT called
      const insertArg = mocks['insertFn'].mock.calls[0][0];
      expect(insertArg.baby_id).toBe('b-1');
      expect(insertArg.kind).toBe('dirty');
      expect(insertArg.created_by).toBe('user-42');
      expect(insertArg.at).toBeUndefined();
      expect(mocks['refetchEqFn']).not.toHaveBeenCalled();
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

  describe('deleteDiaper — chemin RPC symétrique', () => {
    afterEach(() => TestBed.resetTestingModule());

    it('utilise la RPC delete_diaper_with_stock', async () => {
      const mock = makeSupabaseMock(); // rpc succeeds by default
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

      const mocks = (mock as unknown as { _mocks: Record<string, ReturnType<typeof vi.fn>> })._mocks;
      expect(mocks['rpcFn']).toHaveBeenCalledWith('delete_diaper_with_stock', { p_diaper_id: 'd-99' });
      // from() NOT called — RPC handled the delete
      expect(mock.client.from).not.toHaveBeenCalled();
    });

    it('bascule sur le delete direct si la RPC échoue', async () => {
      const mock = makeSupabaseMock({
        rpcResult: { data: null, error: new Error('rpc error') },
      });
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
      const mocks = (mock as unknown as { _mocks: Record<string, ReturnType<typeof vi.fn>> })._mocks;
      expect(mocks['eqFn']).toHaveBeenCalledWith('id', 'd-99');
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
