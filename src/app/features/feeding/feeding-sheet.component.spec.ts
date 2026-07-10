import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { vi, describe, it, expect, afterEach } from 'vitest';
import {
  FeedingSheetComponent,
  FeedingSheetData,
} from './feeding-sheet.component';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FeedingService } from '../../core/feeding/feeding.service';
import { Feeding } from '../../core/feeding/feeding.models';
import { formatChrono } from '../../shared/elapsed-time';

const MOCK_FEEDING_ONGOING: Feeding = {
  id: 'f-1',
  baby_id: 'b-1',
  started_at: new Date(Date.now() - 330_000).toISOString(), // 5 min 30 s ago
  ended_at: null,
  type: 'breast_right',
  amount_ml: null,
  created_by: 'user-1',
  created_at: '',
};

const MOCK_FEEDING_DONE: Feeding = {
  id: 'f-2',
  baby_id: 'b-1',
  started_at: '2026-01-01T08:00:00Z',
  ended_at: '2026-01-01T08:20:00Z',
  type: 'breast_right',
  amount_ml: null,
  created_by: 'user-1',
  created_at: '',
};

function makeFeedingServiceMock() {
  return {
    startFeeding: vi.fn().mockResolvedValue(undefined),
    stopFeeding: vi.fn().mockResolvedValue(undefined),
    recordBottleFeeding: vi.fn().mockResolvedValue(undefined),
    lastFeeding: { value: signal(null) },
    ongoingFeeding: { value: signal(null) },
  };
}

function makeSheetRefMock() {
  return { dismiss: vi.fn() };
}

function makeSnackBarMock() {
  return { open: vi.fn() };
}

async function configure(data: FeedingSheetData) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [FeedingSheetComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: MAT_BOTTOM_SHEET_DATA, useValue: data },
      { provide: MatBottomSheetRef, useValue: makeSheetRefMock() },
      { provide: FeedingService, useValue: makeFeedingServiceMock() },
      { provide: MatSnackBar, useValue: makeSnackBarMock() },
    ],
  }).compileComponents();
}

// ── Mode detection ────────────────────────────────────────────────────────────

describe('FeedingSheetComponent — mode STOP', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affiche le mode STOP quand ongoingFeeding est fourni', async () => {
    await configure({
      ongoingFeeding: MOCK_FEEDING_ONGOING,
      lastFeeding: null,
      babyId: 'b-1',
      preference: 'breast',
    });
    const fixture = TestBed.createComponent(FeedingSheetComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Tétée en cours');
    expect(el.textContent).toContain('Arrêter la tétée');
  });
});

describe('FeedingSheetComponent — mode START', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affiche le mode START quand ongoingFeeding est null', async () => {
    await configure({
      ongoingFeeding: null,
      lastFeeding: null,
      babyId: 'b-1',
      preference: 'breast',
    });
    const fixture = TestBed.createComponent(FeedingSheetComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Démarrer');
    expect(el.textContent).not.toContain('Tétée en cours');
  });
});

// ── Default side selection ────────────────────────────────────────────────────

describe('FeedingSheetComponent — côté par défaut', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('sélectionne le côté gauche si la dernière tétée est le sein droit', async () => {
    await configure({
      ongoingFeeding: null,
      lastFeeding: MOCK_FEEDING_DONE, // type: 'breast_right'
      babyId: 'b-1',
      preference: 'breast',
    });
    const fixture = TestBed.createComponent(FeedingSheetComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance as unknown as { selectedSide: () => string };
    expect(comp.selectedSide()).toBe('breast_left');
  });

  it('sélectionne le côté droit si la dernière tétée est le sein gauche', async () => {
    await configure({
      ongoingFeeding: null,
      lastFeeding: { ...MOCK_FEEDING_DONE, type: 'breast_left' },
      babyId: 'b-1',
      preference: 'breast',
    });
    const fixture = TestBed.createComponent(FeedingSheetComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance as unknown as { selectedSide: () => string };
    expect(comp.selectedSide()).toBe('breast_right');
  });

  it('sélectionne gauche si dernière tétée est biberon', async () => {
    await configure({
      ongoingFeeding: null,
      lastFeeding: { ...MOCK_FEEDING_DONE, type: 'bottle' },
      babyId: 'b-1',
      preference: 'mixed',
    });
    const fixture = TestBed.createComponent(FeedingSheetComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance as unknown as { selectedSide: () => string };
    expect(comp.selectedSide()).toBe('breast_left');
  });
});

// ── Actions (startFeeding / stopFeeding) ─────────────────────────────────────

describe('FeedingSheetComponent — action startFeeding', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('cliquer Démarrer appelle startFeeding avec le bon côté et ferme le sheet', async () => {
    await configure({
      ongoingFeeding: null,
      lastFeeding: null,
      babyId: 'b-1',
      preference: 'breast',
    });
    const feedingService = TestBed.inject(FeedingService);
    const sheetRef = TestBed.inject(MatBottomSheetRef);
    const startSpy = vi.spyOn(feedingService, 'startFeeding').mockResolvedValue(MOCK_FEEDING_DONE as never);
    const dismissSpy = vi.spyOn(sheetRef, 'dismiss');

    const fixture = TestBed.createComponent(FeedingSheetComponent);
    fixture.detectChanges();

    // Find the "Démarrer" button by its text content
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const btn = buttons.find(b => b.textContent?.trim() === 'Démarrer');
    expect(btn).toBeTruthy();
    btn!.click();
    await fixture.whenStable();

    expect(startSpy).toHaveBeenCalledWith('b-1', 'breast_left');
    expect(dismissSpy).toHaveBeenCalledWith({ action: 'started' });
  });

  it('cliquer Arrêter appelle stopFeeding et ferme le sheet', async () => {
    await configure({
      ongoingFeeding: MOCK_FEEDING_ONGOING,
      lastFeeding: null,
      babyId: 'b-1',
      preference: 'breast',
    });
    const feedingService = TestBed.inject(FeedingService);
    const sheetRef = TestBed.inject(MatBottomSheetRef);
    const stopSpy = vi.spyOn(feedingService, 'stopFeeding').mockResolvedValue(undefined as never);
    const dismissSpy = vi.spyOn(sheetRef, 'dismiss');

    const fixture = TestBed.createComponent(FeedingSheetComponent);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button[mat-flat-button]') as HTMLButtonElement;
    btn.click();
    await fixture.whenStable();

    expect(stopSpy).toHaveBeenCalledWith(MOCK_FEEDING_ONGOING.id);
    expect(dismissSpy).toHaveBeenCalledWith({ action: 'stopped' });
  });

  it('échec startFeeding affiche une snackbar et ne ferme pas le sheet', async () => {
    await configure({
      ongoingFeeding: null,
      lastFeeding: null,
      babyId: 'b-1',
      preference: 'breast',
    });
    const feedingService = TestBed.inject(FeedingService);
    const sheetRef = TestBed.inject(MatBottomSheetRef);
    const snackBar = TestBed.inject(MatSnackBar);
    vi.spyOn(feedingService, 'startFeeding').mockRejectedValue(new Error('network'));
    const dismissSpy = vi.spyOn(sheetRef, 'dismiss');
    const snackSpy = vi.spyOn(snackBar, 'open');

    const fixture = TestBed.createComponent(FeedingSheetComponent);
    fixture.detectChanges();

    // Find the "Démarrer" button by its text content
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const btn = buttons.find(b => b.textContent?.trim() === 'Démarrer');
    expect(btn).toBeTruthy();
    btn!.click();
    await fixture.whenStable();

    expect(dismissSpy).not.toHaveBeenCalled();
    expect(snackSpy).toHaveBeenCalledWith(
      expect.stringContaining('Impossible'),
      undefined,
      expect.any(Object),
    );
  });
});

// ── formatChrono unit ─────────────────────────────────────────────────────────

describe('formatChrono', () => {
  it('affiche 05:30 pour 330 secondes', () => {
    expect(formatChrono(330)).toBe('05:30');
  });

  it('affiche 00:00 pour 0 secondes', () => {
    expect(formatChrono(0)).toBe('00:00');
  });

  it('affiche 1:00:00 pour 3600 secondes', () => {
    expect(formatChrono(3600)).toBe('1:00:00');
  });

  it('affiche 1:05:09 pour 3909 secondes', () => {
    expect(formatChrono(3909)).toBe('1:05:09');
  });
});
