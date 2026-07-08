import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormField, form, schema, required, minLength } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HouseholdService } from '../../core/household/household.service';

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
  `,
})
export class OnboardingComponent {
  private readonly householdService = inject(HouseholdService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly createError = signal<string | null>(null);

  private readonly model = signal<CreateHouseholdModel>({ name: '' });

  readonly householdForm = form(
    this.model,
    schema<CreateHouseholdModel>(f => {
      required(f.name);
      minLength(f.name, 2);
    }),
  );

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
