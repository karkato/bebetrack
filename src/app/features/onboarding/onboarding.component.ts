import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormField, form, schema, required, minLength } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HouseholdService } from '../../core/household/household.service';

function extractToken(input: string): string | null {
  const trimmed = input.trim();
  // Full URL: https://…/join/<token>
  const match = trimmed.match(/\/join\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Raw token (no slash)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

interface CreateHouseholdModel {
  name: string;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="onboarding-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Bienvenue sur BébéTrack</mat-card-title>
          <mat-card-subtitle>Créez votre foyer pour commencer</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form (submit)="onCreate($event)">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nom du foyer</mat-label>
              <input
                matInput
                type="text"
                [formField]="householdForm.name"
                placeholder="ex: Famille Dupont"
                autocomplete="off"
              />
              @if (householdForm.name().touched() && householdForm.name().errors().length > 0) {
                <mat-error>{{ householdForm.name().errors()[0].message ?? 'Nom requis' }}</mat-error>
              }
            </mat-form-field>

            @if (createError()) {
              <p class="form-error">{{ createError() }}</p>
            }

            <button mat-flat-button type="submit" [disabled]="loading()">
              @if (loading()) {
                <mat-spinner diameter="20" />
              } @else {
                Créer mon foyer
              }
            </button>
          </form>

          <div class="divider"><span>ou</span></div>

          <div class="join-section">
            <p class="join-hint">Votre partenaire vous a envoyé un lien d'invitation ?</p>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Coller le lien d'invitation</mat-label>
              <input
                matInput
                type="text"
                [value]="inviteInput()"
                (input)="inviteInput.set($any($event.target).value)"
                placeholder="https://… ou token"
                autocomplete="off"
              />
            </mat-form-field>
            @if (joinError()) {
              <p class="form-error">{{ joinError() }}</p>
            }
            <button mat-stroked-button class="full-width" (click)="onJoin()" [disabled]="joinLoading() || !inviteInput().trim()">
              @if (joinLoading()) {
                <mat-spinner diameter="20" />
              } @else {
                Rejoindre le foyer
              }
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .onboarding-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
    }
    mat-card {
      width: 100%;
      max-width: 480px;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 0;
    }
    .full-width {
      width: 100%;
    }
    .form-error {
      color: var(--mat-sys-error);
      margin: 0;
      font-size: 0.875rem;
    }
    button[mat-flat-button] {
      width: 100%;
    }
    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 16px 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--mat-sys-outline-variant);
    }
    .join-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-bottom: 8px;
    }
    .join-hint {
      margin: 0;
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class OnboardingComponent {
  private readonly householdService = inject(HouseholdService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly createError = signal<string | null>(null);

  constructor() {
    // If household loads after magic link auth, skip onboarding
    effect(() => {
      if (this.householdService.hasHousehold()) {
        void this.router.navigate(['/']);
      }
    });
  }

  readonly inviteInput = signal('');
  readonly joinLoading = signal(false);
  readonly joinError = signal<string | null>(null);

  private readonly model = signal<CreateHouseholdModel>({ name: '' });

  readonly householdForm = form(
    this.model,
    schema<CreateHouseholdModel>(f => {
      required(f.name);
      minLength(f.name, 2);
    }),
  );

  async onJoin(): Promise<void> {
    const token = extractToken(this.inviteInput());
    if (!token) {
      this.joinError.set('Lien invalide — colle l\'URL complète ou le token reçu.');
      return;
    }
    this.joinLoading.set(true);
    this.joinError.set(null);
    try {
      await this.householdService.acceptInvite(token);
      await this.router.navigate(['/']);
    } catch {
      this.joinError.set('Lien invalide ou expiré. Demande un nouveau lien à ton partenaire.');
    } finally {
      this.joinLoading.set(false);
    }
  }

  async onCreate(event: Event): Promise<void> {
    event.preventDefault();

    this.householdForm().markAsTouched();

    if (this.householdForm().invalid()) return;

    this.loading.set(true);
    this.createError.set(null);

    try {
      await this.householdService.createHousehold(this.model().name.trim());
      await this.router.navigate(['/']);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création';
      this.createError.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
