import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HouseholdService } from '../../core/household/household.service';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatSnackBarModule],
  template: `
    <div class="home-container">
      <p>BébéTrack — en construction</p>

      <section class="invite-section">
        <button
          mat-stroked-button
          (click)="generateInvite()"
          [disabled]="inviteLoading()"
        >
          <mat-icon>person_add</mat-icon>
          Inviter le second parent
        </button>

        @if (inviteLink()) {
          <div class="invite-link">
            <p>Lien d'invitation :</p>
            <code>{{ inviteLink() }}</code>
            <button mat-flat-button (click)="copyInviteLink()">
              <mat-icon>content_copy</mat-icon>
              Copier
            </button>
          </div>
        }

        @if (inviteError()) {
          <p class="invite-error">{{ inviteError() }}</p>
        }
      </section>
    </div>
  `,
  styles: `
    .home-container {
      padding: 24px;
      max-width: 600px;
      margin: 0 auto;
    }
    .invite-section {
      margin-top: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .invite-link {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      background: var(--mat-sys-surface-variant);
      border-radius: 8px;
    }
    code {
      word-break: break-all;
      font-size: 0.8rem;
    }
    .invite-error {
      color: var(--mat-sys-error);
    }
  `,
})
export class HomeComponent {
  private readonly householdService = inject(HouseholdService);
  private readonly snackBar = inject(MatSnackBar);

  readonly inviteLoading = signal(false);
  readonly inviteLink = signal<string | null>(null);
  readonly inviteError = signal<string | null>(null);

  async generateInvite(): Promise<void> {
    this.inviteLoading.set(true);
    this.inviteError.set(null);

    try {
      const token = await this.householdService.createInvite();
      const link = `${window.location.origin}/join/${token}`;
      this.inviteLink.set(link);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Impossible de créer l\'invitation';
      this.inviteError.set(message);
    } finally {
      this.inviteLoading.set(false);
    }
  }

  async copyInviteLink(): Promise<void> {
    const link = this.inviteLink();
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      this.snackBar.open('Lien copié !', undefined, { duration: 2000 });
    } catch {
      this.snackBar.open('Impossible de copier le lien', undefined, { duration: 3000 });
    }
  }
}
