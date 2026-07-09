import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import { HomeComponent } from './home.component';
import { BabyService } from '../../core/baby/baby.service';
import { DiaperService } from '../../core/diaper/diaper.service';
import { FeedingService } from '../../core/feeding/feeding.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Baby } from '../../core/baby/baby.models';
import { Diaper } from '../../core/diaper/diaper.models';
import { Feeding } from '../../core/feeding/feeding.models';

const MOCK_BABY: Baby = {
  id: 'b-1',
  household_id: 'hh-1',
  name: 'Léa',
  birth_date: '2026-01-01',
  created_at: '',
};

const MOCK_DIAPER: Diaper = {
  id: 'd-1',
  baby_id: 'b-1',
  at: '2026-01-01T10:00:00Z',
  kind: 'wet',
  created_by: 'user-1',
  created_at: '2026-01-01T10:00:00Z',
};

const MOCK_FEEDING: Feeding = {
  id: 'f-1',
  baby_id: 'b-1',
  started_at: new Date(Date.now() - 23 * 60_000).toISOString(),
  ended_at: null,
  type: 'breast_right',
  amount_ml: null,
  created_by: 'user-1',
  created_at: '',
};

async function configure(baby: Baby | null, feeding: Feeding | null = null) {
  TestBed.resetTestingModule();
  const babySignal = signal<Baby | null>(baby);
  const feedingSignal = signal<Feeding | null>(feeding);
  await TestBed.configureTestingModule({
    imports: [HomeComponent],
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: BabyService,
        useValue: {
          currentBaby: babySignal.asReadonly(),
          babies: { value: () => (baby ? [baby] : []), reload: vi.fn() },
          createBaby: vi.fn().mockResolvedValue(undefined),
        },
      },
      {
        provide: DiaperService,
        useValue: {
          createDiaper: vi.fn().mockResolvedValue(MOCK_DIAPER),
          deleteDiaper: vi.fn().mockResolvedValue(undefined),
        },
      },
      {
        provide: FeedingService,
        useValue: { lastFeeding: { value: feedingSignal.asReadonly() } },
      },
      {
        provide: MatSnackBar,
        useValue: { open: vi.fn().mockReturnValue({ onAction: vi.fn().mockReturnValue({ subscribe: vi.fn() }) }) },
      },
    ],
  }).compileComponents();
}

// ── Template rendering ────────────────────────────────────────────────────────

describe('HomeComponent — état vide (currentBaby === null)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affiche le formulaire et cache l\'écran principal', async () => {
    await configure(null);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
    expect(el.querySelector('.home-screen')).toBeNull();
  });
});

describe('HomeComponent — écran principal', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affiche l\'écran principal quand currentBaby est défini', async () => {
    await configure(MOCK_BABY);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.home-screen')).toBeTruthy();
    expect(el.querySelector('.empty-state')).toBeNull();
  });

  it('banner : affiche "Aucune tétée enregistrée" si lastFeeding est null', async () => {
    await configure(MOCK_BABY, null);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.banner-value')?.textContent)
      .toContain('Aucune tétée enregistrée');
  });

  it('banner : affiche le libellé de la dernière tétée', async () => {
    await configure(MOCK_BABY, MOCK_FEEDING);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.banner-value')?.textContent)
      .toContain('sein droit');
  });
});

// ── Timer tick — lastFeedingLabel réactif à la minute ────────────────────────

describe('HomeComponent — timer tick', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('met à jour le libellé après 1 minute sans reload', async () => {
    // Tétée il y a 10 minutes par rapport à maintenant (instant faux)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const feeding: Feeding = { ...MOCK_FEEDING, started_at: tenMinutesAgo };

    await configure(MOCK_BABY, feeding);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.lastFeedingLabel()).toContain('il y a 10 min');

    // Avancer l'horloge de 60 secondes : l'interval du composant se déclenche
    vi.advanceTimersByTime(60_000);

    expect(comp.lastFeedingLabel()).toContain('il y a 11 min');
  });
});

// ── recordDiaper — logic tests via direct method invocation ──────────────────
// Each test monkey-patches the injected service references on the component
// instance to avoid TestBed isolation issues across sequential tests.

describe('HomeComponent — recordDiaper', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('appelle createDiaper avec le bon babyId et kind', async () => {
    await configure(MOCK_BABY);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    // Override injected services with fresh mocks directly on the instance
    const createDiaperFn = vi.fn().mockResolvedValue(MOCK_DIAPER);
    const openFn = vi.fn().mockReturnValue({ onAction: vi.fn().mockReturnValue({ subscribe: vi.fn() }) });
    Object.assign(comp, {
      baby: { currentBaby: () => MOCK_BABY },
      diaperService: { createDiaper: createDiaperFn, deleteDiaper: vi.fn() },
      snackBar: { open: openFn },
    });

    await comp.recordDiaper('dirty');

    expect(createDiaperFn).toHaveBeenCalledWith('b-1', 'dirty');
  });

  it('affiche un snackbar "Couche enregistrée" avec bouton Annuler', async () => {
    await configure(MOCK_BABY);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    const createDiaperFn = vi.fn().mockResolvedValue(MOCK_DIAPER);
    const openFn = vi.fn().mockReturnValue({ onAction: vi.fn().mockReturnValue({ subscribe: vi.fn() }) });
    Object.assign(comp, {
      baby: { currentBaby: () => MOCK_BABY },
      diaperService: { createDiaper: createDiaperFn, deleteDiaper: vi.fn() },
      snackBar: { open: openFn },
    });

    await comp.recordDiaper('wet');

    expect(openFn).toHaveBeenCalledWith('Couche enregistrée', 'Annuler', { duration: 5000 });
  });

  it('appelle deleteDiaper quand l\'utilisateur clique sur "Annuler"', async () => {
    await configure(MOCK_BABY);
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    const deleteDiaperFn = vi.fn().mockResolvedValue(undefined);
    const captured: { cb: (() => void) | null } = { cb: null };
    const subscribeFn = vi.fn((cb: () => void) => { captured.cb = cb; });
    const openFn = vi.fn().mockReturnValue({ onAction: () => ({ subscribe: subscribeFn }) });
    Object.assign(comp, {
      baby: { currentBaby: () => MOCK_BABY },
      diaperService: { createDiaper: vi.fn().mockResolvedValue(MOCK_DIAPER), deleteDiaper: deleteDiaperFn },
      snackBar: { open: openFn },
    });

    await comp.recordDiaper('mixed');

    expect(subscribeFn).toHaveBeenCalled();
    captured.cb?.();
    expect(deleteDiaperFn).toHaveBeenCalledWith(MOCK_DIAPER.id);
  });
});
