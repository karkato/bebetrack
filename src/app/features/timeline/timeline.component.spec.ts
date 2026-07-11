import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { TimelineComponent } from './timeline.component';
import { FeedingService } from '../../core/feeding/feeding.service';
import { DiaperService } from '../../core/diaper/diaper.service';
import { SupabaseService } from '../../core/supabase.service';
import { BabyService } from '../../core/baby/baby.service';
import { SessionService } from '../../core/auth/session.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { MOCK_BABY } from '../../core/baby/testing/baby-fixtures';
import { makeSessionMock } from '../../core/auth/testing/session-mock';
import { makeRealtimeMock } from '../../core/realtime/testing/realtime-mock';
import { makeBabyMock } from '../../core/baby/testing/baby-mock';
import type { Feeding } from '../../core/feeding/feeding.models';
import type { Diaper } from '../../core/diaper/diaper.models';

// ── Supabase mock factory ─────────────────────────────────────────────────────

/**
 * Returns a Supabase mock that serves:
 *  - recentFeedings: .from('feedings').select().eq().gte().order()
 *  - recentDiapers:  .from('diapers').select().eq().gte().order()
 *  - lastFeeding / ongoingFeeding: chained .eq().order().limit().maybeSingle()
 */
function makeSupabaseMock(
  feedings: Feeding[] = [],
  diapers: Diaper[] = [],
) {
  // Chain for recentFeedings / recentDiapers: select → eq → gte → order (resolves)
  const makeFeedingsChain = () => {
    const orderFn = vi.fn().mockResolvedValue({ data: feedings, error: null });
    const gteFn = vi.fn().mockReturnValue({ order: orderFn });
    const eqFn = vi.fn().mockReturnValue({ gte: gteFn, order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    return { selectFn, eqFn, gteFn, orderFn };
  };

  const makeDiapersChain = () => {
    const orderFn = vi.fn().mockResolvedValue({ data: diapers, error: null });
    const gteFn = vi.fn().mockReturnValue({ order: orderFn });
    const eqFn = vi.fn().mockReturnValue({ gte: gteFn, order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    return { selectFn, eqFn, gteFn, orderFn };
  };

  const feedingsChain = makeFeedingsChain();
  const diapersChain = makeDiapersChain();

  // Also support lastFeeding / ongoingFeeding chains (maybeSingle at end)
  const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null });
  const limitFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
  const isFn = vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit: limitFn }) });

  return {
    client: {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'feedings') {
          return {
            select: feedingsChain.selectFn,
            // fallback for lastFeeding / ongoingFeeding chains
            eq: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit: limitFn }), is: isFn }),
            is: isFn,
          };
        }
        if (table === 'diapers') {
          return {
            select: diapersChain.selectFn,
          };
        }
        return {};
      }),
    },
  } as unknown as SupabaseService;
}

// ── Test setup helper ─────────────────────────────────────────────────────────

async function setup(feedings: Feeding[] = [], diapers: Diaper[] = []) {
  const supabaseMock = makeSupabaseMock(feedings, diapers);
  const babyMock = makeBabyMock(MOCK_BABY);
  const sessionMock = makeSessionMock('user-1');
  const { mock: realtimeMock } = makeRealtimeMock();

  await TestBed.configureTestingModule({
    imports: [TimelineComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: SupabaseService, useValue: supabaseMock },
      { provide: BabyService, useValue: babyMock },
      { provide: SessionService, useValue: sessionMock },
      { provide: RealtimeService, useValue: realtimeMock },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(TimelineComponent);
  fixture.detectChanges();
  await new Promise(resolve => setTimeout(resolve, 20));
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance };
}

// ── Tests comportementaux ─────────────────────────────────────────────────────

describe('TimelineComponent — vue Journée', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affiche le message vide quand il n\'y a aucun événement aujourd\'hui', async () => {
    const { fixture } = await setup([], []);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Aucun événement aujourd\'hui');
  });

  it('affiche les événements du jour courant triés par heure décroissante', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const feedings: Feeding[] = [
      {
        id: 'f-early',
        baby_id: 'b-1',
        started_at: `${today}T08:00:00Z`,
        ended_at: `${today}T08:20:00Z`,
        type: 'breast_left',
        amount_ml: null,
        created_by: 'user-1',
        created_at: `${today}T08:00:00Z`,
      },
      {
        id: 'f-late',
        baby_id: 'b-1',
        started_at: `${today}T12:00:00Z`,
        ended_at: `${today}T12:18:00Z`,
        type: 'breast_right',
        amount_ml: null,
        created_by: 'user-1',
        created_at: `${today}T12:00:00Z`,
      },
    ];
    const diapers: Diaper[] = [
      {
        id: 'd-mid',
        baby_id: 'b-1',
        at: `${today}T10:00:00Z`,
        kind: 'wet',
        created_by: 'user-1',
        created_at: `${today}T10:00:00Z`,
      },
    ];

    const { fixture } = await setup(feedings, diapers);
    const el: HTMLElement = fixture.nativeElement;

    const items = el.querySelectorAll('.event-item');
    expect(items.length).toBe(3);

    // Most recent first: f-late (12h), d-mid (10h), f-early (08h)
    // We check that 12h appears before 08h in DOM order
    const texts = Array.from(items).map(i => i.textContent ?? '');
    const latestIdx = texts.findIndex(t => t.includes('sein droit'));
    const earliestIdx = texts.findIndex(t => t.includes('sein gauche'));
    expect(latestIdx).toBeLessThan(earliestIdx);
  });

  it('n\'affiche pas les événements d\'hier dans la vue Journée', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yd = yesterday.toISOString().slice(0, 10);

    const feedings: Feeding[] = [
      {
        id: 'f-yd',
        baby_id: 'b-1',
        started_at: `${yd}T10:00:00Z`,
        ended_at: `${yd}T10:20:00Z`,
        type: 'bottle',
        amount_ml: 90,
        created_by: 'user-1',
        created_at: `${yd}T10:00:00Z`,
      },
    ];

    const { fixture } = await setup(feedings, []);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Aucun événement aujourd\'hui');
  });

  it('affiche le libellé correct pour une tétée biberon avec quantité', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const feedings: Feeding[] = [
      {
        id: 'f-bottle',
        baby_id: 'b-1',
        started_at: `${today}T09:00:00Z`,
        ended_at: `${today}T09:00:00Z`,
        type: 'bottle',
        amount_ml: 80,
        created_by: 'user-1',
        created_at: `${today}T09:00:00Z`,
      },
    ];

    const { fixture } = await setup(feedings, []);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('80 ml');
  });

  it('affiche le libellé correct pour une couche', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const diapers: Diaper[] = [
      {
        id: 'd-1',
        baby_id: 'b-1',
        at: `${today}T09:00:00Z`,
        kind: 'dirty',
        created_by: 'user-1',
        created_at: `${today}T09:00:00Z`,
      },
    ];

    const { fixture } = await setup([], diapers);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Couche sale');
  });
});

describe('TimelineComponent — vue 7 jours', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affiche la table des stats quand on bascule sur la vue 7 jours', async () => {
    const { fixture, component } = await setup([], []);

    component.view.set('week');
    fixture.detectChanges();
    // @defer may need a tick
    await new Promise(resolve => setTimeout(resolve, 20));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    // Table headers must be present
    expect(el.textContent).toContain('Tétées');
    expect(el.textContent).toContain('Intervalle moy.');
  });

  it('affiche "—" pour les jours sans tétées (avgIntervalMs=null)', async () => {
    const { fixture, component } = await setup([], []);

    component.view.set('week');
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 20));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    // All 7 days have 0 feedings → all show "—"
    const dashCount = (el.textContent?.match(/—/g) ?? []).length;
    expect(dashCount).toBeGreaterThanOrEqual(7);
  });

  it('affiche les 7 lignes dans la table', async () => {
    const { fixture, component } = await setup([], []);

    component.view.set('week');
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 20));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.week-table tbody tr');
    expect(rows.length).toBe(7);
  });
});

describe('TimelineComponent — Realtime', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('recharge recentFeedings quand un événement Realtime arrive sur le canal feedings', async () => {
    const supabaseMock = makeSupabaseMock([], []);
    const babyMock = makeBabyMock(MOCK_BABY);
    const sessionMock = makeSessionMock('user-1');

    // Multi-capturing mock: stores cb per channel name
    const unsubscribeFn = vi.fn();
    const callbacks = new Map<string, (...args: unknown[]) => void>();
    const subscribeFn = vi.fn().mockImplementation(
      (channelName: string, _table: string, _filter: string, cb: (...args: unknown[]) => void) => {
        callbacks.set(channelName, cb);
        return { unsubscribe: unsubscribeFn };
      },
    );
    const multiCaptureMock = {
      subscribe: subscribeFn,
      status: { subscribe: vi.fn() },
    } as unknown as RealtimeService;

    await TestBed.configureTestingModule({
      imports: [TimelineComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BabyService, useValue: babyMock },
        { provide: SessionService, useValue: sessionMock },
        { provide: RealtimeService, useValue: multiCaptureMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TimelineComponent);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 20));

    const feedingService = TestBed.inject(FeedingService);
    const diaperService = TestBed.inject(DiaperService);

    const reloadFeedings = vi.spyOn(feedingService.recentFeedings, 'reload');
    const reloadDiapers = vi.spyOn(diaperService.recentDiapers, 'reload');

    // Trigger feedings channel event
    const feedingsCb = callbacks.get(`feedings-baby-${MOCK_BABY.id}`);
    expect(feedingsCb).toBeDefined();
    feedingsCb?.();

    expect(reloadFeedings).toHaveBeenCalled();
    // diapers reload not triggered by feedings event
    expect(reloadDiapers).not.toHaveBeenCalled();

    // Trigger diapers channel event
    const diapersCb = callbacks.get(`diapers-baby-${MOCK_BABY.id}`);
    expect(diapersCb).toBeDefined();
    diapersCb?.();

    expect(reloadDiapers).toHaveBeenCalled();
  });
});

describe('TimelineComponent — toggle vue', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('démarre en vue Journée par défaut', async () => {
    const { component } = await setup();
    expect(component.view()).toBe('day');
  });

  it('bascule vers la vue 7 jours', async () => {
    const { component } = await setup();
    component.view.set('week');
    expect(component.view()).toBe('week');
  });
});
