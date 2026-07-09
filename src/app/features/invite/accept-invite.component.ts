import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HouseholdService } from '../../core/household/household.service';

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatProgressSpinnerModule],
  template: `
    <div class="invite-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Rejoindre un foyer</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (loading()) {
            <div class="spinner-wrapper">
              <mat-spinner diameter="48" />
              <p>Validation de l'invitation…</p>
            </div>
          } @else if (error()) {
            <p class="invite-error">{{ error() }}</p>
            <button mat-flat-button (click)="retry()">Réessayer</button>
          } @else {
            <p>Invitation acceptée avec succès !</p>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .invite-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
    }
    mat-card {
      width: 100%;
      max-width: 400px;
    }
    mat-card-content {
      padding-top: 16px;
    }
    .spinner-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .invite-error {
      color: var(--mat-sys-error);
    }
  `,
})
export class AcceptInviteComponent implements OnInit {
  /** Route param bound via withComponentInputBinding() */
  readonly token = input.required<string>();

  private readonly householdService = inject(HouseholdService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.accept();
  }

  async accept(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.householdService.acceptInvite(this.token());
      await this.router.navigate(['/']);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lien d\'invitation invalide ou expiré';
      this.error.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  retry(): void {
    this.accept();
  }
}
