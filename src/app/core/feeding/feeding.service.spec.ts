import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { FeedingService } from './feeding.service';
import { SupabaseService } from '../supabase.service';
import { BabyService } from '../baby/baby.service';
import { SessionService } from '../auth/session.service';
import { RealtimeService } from '../realtime/realtime.service';
import { Feeding } from './feeding.models';
import { Baby } from '../baby/baby.models';
import { MOCK_BABY, MOCK_BABY_B } from '../baby/testing/baby-fixtures';
import { makeSessionMock } from '../auth/testing/session-mock';
import { makeRealtimeMock, makeCapturingRealtimeMock } from '../realtime/testing/realtime-mock';
import { MOCK_FEEDING } from './testing/feeding-fixtures';
import { makeBabyMock } from '../baby/testing/baby-mock';

/** Builds a Supabase mock for the lastFeeding/ongoingFeeding read path */
function makeReadSupabaseMock(returnedFeeding: Feeding | null) {
  const maybeSingleFn = vi.fn().mockResolvedValue({ data: returnedFeeding, error: null });
  const limitFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
  const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
  // is() is used by ongoingFeeding — now also chains .order().limit().maybeSingle()
  const isFn = vi.fn().mockReturnValue({ order: orderFn });
  const eqFn = vi.fn().mockReturnValue({ order: orderFn, is: isFn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
  return {
    client: {
      from: vi.fn().mockReturnValue({ select: selectFn }),
    },
  } as unknown as SupabaseService;
}

// ── resource tests ────────────────────────────────────────────────────────────

describe('FeedingService — lastFeeding resource', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ne déclenche pas de requête quand currentBaby est null', async () => {
    const supabaseMock = makeReadSupabaseMock(null);
    const babyMock = makeBabyMock(null);
    const sessionMock = makeSessionMock('user-1');
    const { mock: realtimeMock } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    TestBed.inject(FeedingService);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(supabaseMock.client.from).not.toHaveBeenCalled();
  });

  it('retourne la tétée chargée depuis Supabase', async () => {
    const supabaseMock = makeReadSupabaseMock(MOCK_FEEDING);
    const babyMock = makeBabyMock(MOCK_BABY);
    const sessionMock = makeSessionMock('user-1');
    const { mock: realtimeMock } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    const svc = TestBed.inject(FeedingService);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(supabaseMock.client.from).toHaveBeenCalledWith('feedings');
    expect(svc.lastFeeding.value()).toEqual(MOCK_FEEDING);
  });
});

describe('FeedingService — ongoingFeeding resource', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('retourne null quand toutes les tétées ont ended_at non null', async () => {
    // maybeSingle returns null = no ongoing feeding
    const supabaseMock = makeReadSupabaseMock(null);
    const babyMock = makeBabyMock(MOCK_BABY);
    const sessionMock = makeSessionMock('user-1');
    const { mock: realtimeMock } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    const svc = TestBed.inject(FeedingService);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(svc.ongoingFeeding.value()).toBeNull();
  });

  it('retourne la tétée en cours (ended_at IS NULL)', async () => {
    const ongoingFeeding: Feeding = { ...MOCK_FEEDING, ended_at: null };
    const supabaseMock = makeReadSupabaseMock(ongoingFeeding);
    const babyMock = makeBabyMock(MOCK_BABY);
    const sessionMock = makeSessionMock('user-1');
    const { mock: realtimeMock } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    const svc = TestBed.inject(FeedingService);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(svc.ongoingFeeding.value()).toEqual(ongoingFeeding);
  });
});

// ── mutation tests ────────────────────────────────────────────────────────────

describe('FeedingService — startFeeding', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('insère une row avec ended_at absent (null) et retourne la tétée', async () => {
    const insertedFeeding: Feeding = { ...MOCK_FEEDING, ended_at: null, type: 'breast_left' };
    const singleFn = vi.fn().mockResolvedValue({ data: insertedFeeding, error: null });
    const insertSelectFn = vi.fn().mockReturnValue({ single: singleFn });
    const insertFn = vi.fn().mockReturnValue({ select: insertSelectFn });

    const supabaseMock = {
      client: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: insertFn,
        }),
      },
    } as unknown as SupabaseService;

    const babyMock = makeBabyMock(null);
    const sessionMock = makeSessionMock('user-1');
    const { mock: realtimeMock } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    const svc = TestBed.inject(FeedingService);
    const result = await svc.startFeeding('b-1', 'breast_left');

    expect(insertFn).toHaveBeenCalledWith({
      baby_id: 'b-1',
      type: 'breast_left',
      created_by: 'user-1',
    });
    expect(result).toEqual(insertedFeeding);
  });

  it('lève une erreur si non authentifié', async () => {
    const supabaseMock = makeReadSupabaseMock(null);
    const babyMock = makeBabyMock(null);
    const sessionMock = makeSessionMock(null);
    const { mock: realtimeMock } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    const svc = TestBed.inject(FeedingService);
    await expect(svc.startFeeding('b-1', 'breast_left')).rejects.toThrow('Not authenticated');
  });
});

describe('FeedingService — stopFeeding', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('met à jour ended_at sur la row identifiée par id', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });

    const supabaseMock = {
      client: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: updateFn,
        }),
      },
    } as unknown as SupabaseService;

    const babyMock = makeBabyMock(null);
    const sessionMock = makeSessionMock('user-1');
    const { mock: realtimeMock } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    const svc = TestBed.inject(FeedingService);
    await svc.stopFeeding('f-42');

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ ended_at: expect.any(String) })
    );
    expect(eqFn).toHaveBeenCalledWith('id', 'f-42');
  });
});

describe('FeedingService — recordBottleFeeding', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('insère avec started_at = ended_at et amount_ml, retourne la tétée', async () => {
    const bottleFeeding: Feeding = {
      ...MOCK_FEEDING,
      type: 'bottle',
      amount_ml: 90,
      ended_at: MOCK_FEEDING.started_at,
    };
    const singleFn = vi.fn().mockResolvedValue({ data: bottleFeeding, error: null });
    const insertSelectFn = vi.fn().mockReturnValue({ single: singleFn });
    const insertFn = vi.fn().mockReturnValue({ select: insertSelectFn });

    const supabaseMock = {
      client: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: insertFn,
        }),
      },
    } as unknown as SupabaseService;

    const babyMock = makeBabyMock(null);
    const sessionMock = makeSessionMock('user-1');
    const { mock: realtimeMock } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    const svc = TestBed.inject(FeedingService);
    const result = await svc.recordBottleFeeding('b-1', 90);

    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        baby_id: 'b-1',
        type: 'bottle',
        amount_ml: 90,
        created_by: 'user-1',
        started_at: expect.any(String),
        ended_at: expect.any(String),
      })
    );
    // started_at and ended_at must be equal (same instant)
    const callArg = insertFn.mock.calls[0][0];
    expect(callArg.started_at).toEqual(callArg.ended_at);
    expect(result).toEqual(bottleFeeding);
  });

  it('lève une erreur si non authentifié', async () => {
    const supabaseMock = makeReadSupabaseMock(null);
    const babyMock = makeBabyMock(null);
    const sessionMock = makeSessionMock(null);
    const { mock: realtimeMock } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    const svc = TestBed.inject(FeedingService);
    await expect(svc.recordBottleFeeding('b-1', 90)).rejects.toThrow('Not authenticated');
  });
});

// ── Realtime tests ────────────────────────────────────────────────────────────

describe('FeedingService — Realtime subscription', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('appelle subscribe() avec table feedings et le bon filtre quand currentBaby est défini', async () => {
    const supabaseMock = makeReadSupabaseMock(MOCK_FEEDING);
    const babyMock = makeBabyMock(MOCK_BABY);
    const sessionMock = makeSessionMock('user-1');
    const { mock: realtimeMock, subscribeFn } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    TestBed.inject(FeedingService);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(subscribeFn).toHaveBeenCalledWith(
      'feedings-baby-b-1',
      'feedings',
      'baby_id=eq.b-1',
      expect.any(Function),
    );
  });

  it("n'appelle pas subscribe() quand currentBaby est null", async () => {
    const supabaseMock = makeReadSupabaseMock(null);
    const babyMock = makeBabyMock(null);
    const sessionMock = makeSessionMock('user-1');
    const { mock: realtimeMock, subscribeFn } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    TestBed.inject(FeedingService);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(subscribeFn).not.toHaveBeenCalled();
  });

  it('appelle unsubscribe() quand currentBaby passe à null', async () => {
    const supabaseMock = makeReadSupabaseMock(MOCK_FEEDING);
    const babyMock = makeBabyMock(MOCK_BABY);
    const sessionMock = makeSessionMock('user-1');
    const { mock: realtimeMock, unsubscribeFn } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    TestBed.inject(FeedingService);
    await new Promise(resolve => setTimeout(resolve, 0));

    // Change baby to null — triggers effect cleanup
    (babyMock as unknown as { _signal: ReturnType<typeof signal<Baby | null>> })._signal.set(null);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(unsubscribeFn).toHaveBeenCalled();
  });

  // S3: re-subscribe when currentBaby changes from A to B
  it('re-souscrit quand currentBaby change de A vers B', async () => {
    const supabaseMock = makeReadSupabaseMock(MOCK_FEEDING);
    const babyMock = makeBabyMock(MOCK_BABY);
    const sessionMock = makeSessionMock('user-1');
    const { mock: realtimeMock, subscribeFn, unsubscribeFn } = makeRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    TestBed.inject(FeedingService);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(subscribeFn).toHaveBeenCalledTimes(1);
    expect(subscribeFn).toHaveBeenCalledWith(
      `feedings-baby-${MOCK_BABY.id}`,
      'feedings',
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
      `feedings-baby-${MOCK_BABY_B.id}`,
      'feedings',
      `baby_id=eq.${MOCK_BABY_B.id}`,
      expect.any(Function),
    );
  });

  it('un event Realtime déclenche reload() sur lastFeeding et ongoingFeeding', async () => {
    const supabaseMock = makeReadSupabaseMock(MOCK_FEEDING);
    const babyMock = makeBabyMock(MOCK_BABY);
    const sessionMock = makeSessionMock('user-1');
    const { mock: realtimeMock, holder } = makeCapturingRealtimeMock();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();

    const svc = TestBed.inject(FeedingService);
    await new Promise(resolve => setTimeout(resolve, 10));

    // Spy on reload after initial load
    const reloadLast = vi.spyOn(svc.lastFeeding, 'reload');
    const reloadOngoing = vi.spyOn(svc.ongoingFeeding, 'reload');

    // Simulate a Realtime event
    holder.cb?.();

    expect(reloadLast).toHaveBeenCalled();
    expect(reloadOngoing).toHaveBeenCalled();
  });
});
