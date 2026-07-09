import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, computed, resource } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HomeComponent } from './home.component';
import { BabyService } from '../../core/baby/baby.service';
import { DiaperService } from '../../core/diaper/diaper.service';
import { FeedingService } from '../../core/feeding/feeding.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Baby } from '../../core/baby/baby.models';
import { Diaper } from '../../core/diaper/diaper.models';
import { Feeding } from '../../core/feeding/feeding.models';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

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

function makeBabyMock(baby: Baby | null) {
  const babySignal = signal(baby);
  return {
    currentBaby: babySignal.asReadonly(),
    babies: { value: () => baby ? [baby] : [], reload: vi.fn() },
    createBaby: vi.fn().mockResolvedValue(undefined),
  } as unknown as BabyService;
}

function makeDiaperMock(diaper: Diaper = MOCK_DIAPER) {
  return {
    createDiaper: vi.fn().mockResolvedValue(diaper),
    deleteDiaper: vi.fn().mockResolvedValue(undefined),
  } as unknown as DiaperService;
}

function makeFeedingMock(feeding: Feeding | null = null) {
  const feedingSignal = signal(feeding);
  return {
    lastFeeding: { value: feedingSignal.asReadonly() },
  } as unknown as FeedingService;
}

function makeSnackBarMock() {
  const onActionFn = vi.fn().mockReturnValue({ subscribe: vi.fn() });
  const openFn = vi.fn().mockReturnValue({ onAction: onActionFn });
  return { open: openFn, _onAction: onActionFn } as unknown as MatSnackBar & { _onAction: ReturnType<typeof vi.fn> };
}

async function setup(baby: Baby | null, feeding: Feeding | null = null) {
  const babyMock = makeBabyMock(baby);
  const diaperMock = makeDiaperMock();
  const feedingMock = makeFeedingMock(feeding);
  const snackBarMock = makeSnackBarMock();

  await TestBed.configureTestingModule({
    imports: [HomeComponent, NoopAnimationsModule],
    providers: [
      provideZonelessChangeDetection(),
      { provide: BabyService, useValue: babyMock },
      { provide: DiaperService, useValue: diaperMock },
      { provide: FeedingService, useValue: feedingMock },
      { provide: MatSnackBar, useValue: snackBarMock },
    ],
  }).compileComponents();

  return { babyMock, diaperMock, feedingMock, snackBarMock };
}

describe('HomeComponent', () => {
  describe('état vide — currentBaby === null', () => {
    it('affiche le formulaire d\'ajout de bébé', async () => {
      await setup(null);
      const fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.empty-state')).toBeTruthy();
      expect(el.querySelector('.home-screen')).toBeNull();
    });

    it('cache l\'écran principal', async () => {
      await setup(null);
      const fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.home-screen')).toBeNull();
    });
  });

  describe('écran principal — currentBaby présent', () => {
    it('affiche l\'écran principal et cache le formulaire', async () => {
      await setup(MOCK_BABY);
      const fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.home-screen')).toBeTruthy();
      expect(el.querySelector('.empty-state')).toBeNull();
    });

    it('affiche "Aucune tétée enregistrée" si lastFeeding est null', async () => {
      await setup(MOCK_BABY, null);
      const fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.banner-value')?.textContent).toContain('Aucune tétée enregistrée');
    });

    it('affiche le libellé de la dernière tétée si présente', async () => {
      await setup(MOCK_BABY, MOCK_FEEDING);
      const fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const bannerValue = el.querySelector('.banner-value')?.textContent ?? '';
      expect(bannerValue).toContain('sein droit');
    });
  });

  describe('recordDiaper — enregistrement d\'une couche', () => {
    it('appelle createDiaper avec le bon kind', async () => {
      const { diaperMock } = await setup(MOCK_BABY);
      const fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();

      await fixture.componentInstance.recordDiaper('dirty');

      expect(diaperMock.createDiaper).toHaveBeenCalledWith('b-1', 'dirty');
    });

    it('affiche un snackbar après l\'enregistrement', async () => {
      const { snackBarMock } = await setup(MOCK_BABY);
      const fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();

      await fixture.componentInstance.recordDiaper('wet');

      expect(snackBarMock.open).toHaveBeenCalledWith(
        'Couche enregistrée',
        'Annuler',
        { duration: 5000 },
      );
    });

    it('appelle deleteDiaper si l\'utilisateur clique sur "Annuler"', async () => {
      const { diaperMock, snackBarMock } = await setup(MOCK_BABY);

      let actionCallback: (() => void) | null = null;
      const subscribeFn = vi.fn((cb: () => void) => { actionCallback = cb; });
      (snackBarMock as unknown as { open: ReturnType<typeof vi.fn> }).open.mockReturnValue({
        onAction: () => ({ subscribe: subscribeFn }),
      });

      const fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();

      await fixture.componentInstance.recordDiaper('mixed');

      expect(subscribeFn).toHaveBeenCalled();
      actionCallback?.();
      expect(diaperMock.deleteDiaper).toHaveBeenCalledWith(MOCK_DIAPER.id);
    });
  });
});
