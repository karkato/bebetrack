import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FeedingPreference } from '../../core/baby/baby.models';
import { Feeding } from '../../core/feeding/feeding.models';
import { FeedingService } from '../../core/feeding/feeding.service';
import { formatChrono } from '../../shared/elapsed-time';

export interface FeedingSheetData {
  ongoingFeeding: Feeding | null;
  lastFeeding: Feeding | null;
  babyId: string;
  preference: FeedingPreference;
}

@Component({
  selector: 'app-feeding-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
  template: `
    @if (mode() === 'stop') {
      <div class="sheet-content">
        <div class="sheet-header">Tétée en cours</div>
        <div class="chrono">{{ chronoLabel() }}</div>
        <button mat-flat-button class="full-width" (click)="stopFeeding()">Arrêter la tétée</button>
      </div>
    } @else {
      <div class="sheet-content">
        @if (activeView() === 'breast') {
          <div class="side-buttons">
            <button mat-flat-button
              [class.selected]="selectedSide() === 'breast_left'"
              (click)="selectSide('breast_left')">Gauche</button>
            <button mat-flat-button
              [class.selected]="selectedSide() === 'breast_right'"
              (click)="selectSide('breast_right')">Droite</button>
          </div>
          <button mat-flat-button class="full-width" (click)="startFeeding()" [disabled]="!selectedSide()">Démarrer</button>
          @if (data.preference === 'mixed') {
            <button mat-button class="full-width" (click)="activeView.set('bottle')">Biberon</button>
          }
        } @else {
          <label class="amount-label">
            Quantité (ml)
            <input class="amount-input" type="number" min="1" [value]="amountMl()" (input)="amountMl.set(+$any($event.target).value)" />
          </label>
          <button mat-flat-button class="full-width" (click)="recordBottle()" [disabled]="amountMl() < 1">Enregistrer</button>
          @if (data.preference === 'mixed') {
            <button mat-button class="full-width" (click)="activeView.set('breast')">Allaitement</button>
          }
        }
      </div>
    }
  `,
  styles: `
    .sheet-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 24px 16px 32px;
    }

    .sheet-header {
      font-size: 1.1rem;
      font-weight: 600;
      text-align: center;
      color: var(--mat-sys-on-surface);
    }

    .chrono {
      font-size: 3rem;
      font-weight: 300;
      text-align: center;
      letter-spacing: 0.05em;
      color: var(--mat-sys-primary);
    }

    .side-buttons {
      display: flex;
      gap: 12px;
    }

    .side-buttons button {
      flex: 1;
    }

    .side-buttons button.selected {
      background-color: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }

    .full-width {
      width: 100%;
    }

    .amount-label {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 0.9rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .amount-input {
      width: 100%;
      padding: 12px;
      font-size: 1.25rem;
      text-align: center;
      background: var(--mat-sys-surface-container);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      color: var(--mat-sys-on-surface);
      box-sizing: border-box;
    }
  `,
})
export class FeedingSheetComponent {
  protected readonly data = inject<FeedingSheetData>(MAT_BOTTOM_SHEET_DATA);
  private readonly sheetRef = inject(MatBottomSheetRef);
  private readonly feedingService = inject(FeedingService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly mode = computed(() => (this.data.ongoingFeeding ? 'stop' : 'start'));

  // Chrono tétée en cours (tick toutes les secondes)
  private readonly now = signal(Date.now());

  protected readonly chronoLabel = computed(() => {
    const n = this.now();
    const feeding = this.data.ongoingFeeding;
    if (!feeding) return '00:00';
    const seconds = Math.floor((n - new Date(feeding.started_at).getTime()) / 1000);
    return formatChrono(seconds);
  });

  // Côté par défaut : opposé au dernier, ou gauche
  protected readonly selectedSide = signal<'breast_left' | 'breast_right' | null>(
    this.computeDefaultSide(),
  );

  // Vue active (sein ou biberon)
  protected readonly activeView = signal<'breast' | 'bottle'>(
    this.data.preference === 'bottle' ? 'bottle' : 'breast',
  );

  // Quantité biberon
  protected readonly amountMl = signal(0);

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 1_000);
    this.destroyRef.onDestroy(() => clearInterval(id));
  }

  protected selectSide(side: 'breast_left' | 'breast_right'): void {
    this.selectedSide.set(side);
  }

  protected async startFeeding(): Promise<void> {
    const side = this.selectedSide();
    if (!side) return;
    try {
      await this.feedingService.startFeeding(this.data.babyId, side);
      this.sheetRef.dismiss({ action: 'started' });
    } catch {
      this.snackBar.open('Impossible de démarrer la tétée', undefined, { duration: 3000 });
    }
  }

  protected async stopFeeding(): Promise<void> {
    const ongoing = this.data.ongoingFeeding;
    if (!ongoing) return;
    try {
      await this.feedingService.stopFeeding(ongoing.id);
      this.sheetRef.dismiss({ action: 'stopped' });
    } catch {
      this.snackBar.open('Impossible d\'arrêter la tétée', undefined, { duration: 3000 });
    }
  }

  protected async recordBottle(): Promise<void> {
    const ml = this.amountMl();
    if (ml < 1) return;
    try {
      await this.feedingService.recordBottleFeeding(this.data.babyId, Math.round(ml));
      this.sheetRef.dismiss({ action: 'bottle' });
    } catch {
      this.snackBar.open('Impossible d\'enregistrer le biberon', undefined, { duration: 3000 });
    }
  }

  private computeDefaultSide(): 'breast_left' | 'breast_right' {
    const last = this.data.lastFeeding;
    if (last?.type === 'breast_right') return 'breast_left';
    if (last?.type === 'breast_left') return 'breast_right';
    return 'breast_left'; // biberon ou null → gauche par défaut
  }
}
