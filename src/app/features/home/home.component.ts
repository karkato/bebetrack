import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BabyService } from '../../core/baby/baby.service';
import { DiaperService } from '../../core/diaper/diaper.service';
import { DiaperKind } from '../../core/diaper/diaper.models';
import { FeedingService } from '../../core/feeding/feeding.service';
import { formatElapsed, feedingTypeLabel } from '../../shared/elapsed-time';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatSnackBarModule],
  template: `
    @if (baby.currentBaby() === null) {
      <div class="empty-state">
        <h2>Bienvenue sur BébéTrack</h2>
        <p>Commencez par ajouter votre bébé.</p>

        <form class="baby-form" (submit)="$event.preventDefault(); submitBaby()">
          <div class="field">
            <label for="baby-name">Prénom</label>
            <input
              id="baby-name"
              type="text"
              [value]="babyName()"
              (input)="babyName.set($any($event.target).value)"
              placeholder="Prénom du bébé"
              required
            />
          </div>

          <div class="field">
            <label for="baby-birth">Date de naissance</label>
            <input
              id="baby-birth"
              type="date"
              [value]="babyBirthDate()"
              (input)="babyBirthDate.set($any($event.target).value)"
              required
            />
          </div>

          @if (babyFormError()) {
            <p class="form-error">{{ babyFormError() }}</p>
          }

          <button
            type="submit"
            mat-flat-button
            class="submit-btn"
            [disabled]="babyFormLoading()"
          >
            {{ babyFormLoading() ? 'Ajout en cours…' : 'Ajouter le bébé' }}
          </button>
        </form>
      </div>
    } @else {
      <div class="home-screen">
        <header class="last-feeding-banner">
          <p class="banner-label">Dernière tétée</p>
          <p class="banner-value">{{ lastFeedingLabel() }}</p>
        </header>

        <section class="diaper-buttons">
          <button class="diaper-btn" (click)="recordDiaper('wet')">
            <span class="btn-icon">💧</span>
            <span class="btn-label">Pipi</span>
          </button>
          <button class="diaper-btn" (click)="recordDiaper('dirty')">
            <span class="btn-icon">💩</span>
            <span class="btn-label">Selle</span>
          </button>
          <button class="diaper-btn" (click)="recordDiaper('mixed')">
            <span class="btn-icon">🌊</span>
            <span class="btn-label">Mixte</span>
          </button>
        </section>

        <button class="feeding-btn" disabled>
          <span class="btn-icon">🍼</span>
          <span class="btn-label">Tétée</span>
        </button>
      </div>
    }
  `,
  styles: `
    /* ── Empty state ── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      padding: 24px;
      box-sizing: border-box;
      text-align: center;
      background-color: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
    }

    .empty-state h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 8px;
    }

    .empty-state p {
      margin: 0 0 32px;
      color: var(--mat-sys-on-surface-variant);
    }

    .baby-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
      max-width: 360px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-align: left;
    }

    .field label {
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .field input {
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline);
      background: var(--mat-sys-surface-variant);
      color: var(--mat-sys-on-surface);
      font-size: 1rem;
      outline: none;
    }

    .field input:focus {
      border-color: var(--mat-sys-primary);
    }

    .form-error {
      color: var(--mat-sys-error);
      font-size: 0.875rem;
      margin: 0;
    }

    .submit-btn {
      min-height: 56px;
      font-size: 1rem;
    }

    /* ── Main screen ── */
    .home-screen {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
      background-color: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
    }

    /* ── Last feeding banner ── */
    .last-feeding-banner {
      padding: 24px 16px 20px;
      text-align: center;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    .banner-label {
      margin: 0 0 4px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--mat-sys-on-surface-variant);
    }

    .banner-value {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 500;
    }

    /* ── Diaper buttons ── */
    .diaper-buttons {
      display: flex;
      gap: 12px;
      padding: 24px 16px;
    }

    .diaper-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 80px;
      padding: 12px 8px;
      border: none;
      border-radius: 16px;
      background: var(--mat-sys-surface-container);
      color: var(--mat-sys-on-surface);
      cursor: pointer;
      transition: background 0.15s;
      gap: 6px;
    }

    .diaper-btn:active {
      background: var(--mat-sys-surface-container-high);
    }

    .btn-icon {
      font-size: 2rem;
      line-height: 1;
    }

    .btn-label {
      font-size: 0.875rem;
      font-weight: 500;
    }

    /* ── Feeding button ── */
    .feeding-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 0 16px;
      min-height: 100px;
      border: none;
      border-radius: 24px;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      cursor: pointer;
      font-size: 1rem;
      gap: 8px;
      transition: opacity 0.15s;
    }

    .feeding-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .feeding-btn .btn-icon {
      font-size: 2.5rem;
    }

    .feeding-btn .btn-label {
      font-size: 1rem;
      font-weight: 600;
    }
  `,
})
export class HomeComponent {
  readonly baby = inject(BabyService);
  readonly feedingService = inject(FeedingService);
  readonly diaperService = inject(DiaperService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  // ── Timer (1-minute tick for elapsed display) ──
  private readonly now = signal(Date.now());

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(id));
  }

  // ── Last feeding label ──
  readonly lastFeedingLabel = computed(() => {
    const feeding = this.feedingService.lastFeeding.value();
    if (!feeding) return 'Aucune tétée enregistrée';
    const elapsed = formatElapsed(new Date(feeding.started_at), new Date(this.now()));
    const typeLabel = feedingTypeLabel(feeding.type);
    return `${elapsed} (${typeLabel})`;
  });

  // ── Empty state form ──
  readonly babyName = signal('');
  readonly babyBirthDate = signal('');
  readonly babyFormLoading = signal(false);
  readonly babyFormError = signal<string | null>(null);

  async submitBaby(): Promise<void> {
    const name = this.babyName().trim();
    const birthDate = this.babyBirthDate();
    if (!name || !birthDate) {
      this.babyFormError.set('Le prénom et la date de naissance sont requis.');
      return;
    }
    this.babyFormLoading.set(true);
    this.babyFormError.set(null);
    try {
      await this.baby.createBaby(name, birthDate);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Impossible d'ajouter le bébé";
      this.babyFormError.set(message);
    } finally {
      this.babyFormLoading.set(false);
    }
  }

  // ── Diaper recording with undo ──
  async recordDiaper(kind: DiaperKind): Promise<void> {
    const babyId = this.baby.currentBaby()?.id;
    if (!babyId) return;
    try {
      const diaper = await this.diaperService.createDiaper(babyId, kind);
      const ref = this.snackBar.open('Couche enregistrée', 'Annuler', { duration: 5000 });
      ref.onAction().subscribe(() => {
        this.diaperService.deleteDiaper(diaper.id);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement';
      this.snackBar.open(message, undefined, { duration: 3000 });
    }
  }
}
