import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HouseholdService } from '../../core/household/household.service';
import { SessionService } from '../../core/auth/session.service';

@Component({
  selector: 'app-foyer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatListModule],
  template: `
    <div class="foyer-container">
      <header class="foyer-header">
        <h1>{{ householdService.household()?.name ?? 'Mon foyer' }}</h1>
      </header>

      <section class="section">
        <h2 class="section-title">Parents</h2>
        @if (members.isLoading()) {
          <p class="hint">Chargement…</p>
        } @else {
          <mat-list>
            @for (member of members.value() ?? []; track member.user_id) {
              <mat-list-item>
                <mat-icon matListItemIcon>person</mat-icon>
                <span matListItemTitle>
                  {{ member.email }}
                  @if (member.user_id === currentUserId()) {
                    <span class="you-badge">vous</span>
                  }
                </span>
              </mat-list-item>
            }
          </mat-list>
        }
      </section>

      <section class="section">
        <h2 class="section-title">Inviter un parent</h2>
        @if (inviteUrl()) {
          <div class="invite-url-box">
            <span class="invite-url-text">{{ inviteUrl() }}</span>
            <div class="invite-url-actions">
              <button mat-stroked-button (click)="copyInviteUrl()">Copier</button>
              @if (canShare()) {
                <button mat-flat-button (click)="shareInviteUrl()">Partager</button>
              }
            </div>
            <button mat-button (click)="inviteUrl.set(null)">Générer un nouveau lien</button>
          </div>
        } @else {
          <p class="hint">Partagez un lien d'invitation pour que votre partenaire rejoigne ce foyer.</p>
          <button mat-flat-button class="full-width" (click)="generateInvite()" [disabled]="inviteLoading()">
            {{ inviteLoading() ? 'Génération…' : "🔗 Générer un lien d'invitation" }}
          </button>
        }
      </section>
    </div>
  `,
  styles: `
    .foyer-container {
      padding: 24px 16px 96px;
      max-width: 600px;
      margin: 0 auto;
    }

    .foyer-header h1 {
      margin: 0 0 24px;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .section {
      margin-bottom: 32px;
    }

    .section-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 8px;
    }

    .hint {
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 12px;
    }

    .you-badge {
      display: inline-block;
      margin-left: 8px;
      padding: 2px 8px;
      border-radius: 12px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-size: 0.7rem;
      font-weight: 600;
      vertical-align: middle;
    }

    .full-width {
      width: 100%;
    }

    .invite-url-box {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      border-radius: 10px;
      background: var(--mat-sys-surface-container);
      border: 1px solid var(--mat-sys-outline-variant);
    }

    .invite-url-text {
      font-size: 0.75rem;
      word-break: break-all;
      color: var(--mat-sys-on-surface-variant);
      font-family: monospace;
    }

    .invite-url-actions {
      display: flex;
      gap: 8px;
    }

    .invite-url-actions button {
      flex: 1;
    }
  `,
})
export class FoyerComponent {
  protected readonly householdService = inject(HouseholdService);
  private readonly session = inject(SessionService);
  private readonly snackBar = inject(MatSnackBar);

  readonly currentUserId = computed(() => this.session.user()?.id ?? null);
  readonly canShare = signal(typeof navigator !== 'undefined' && !!navigator.share);

  readonly members = resource({
    params: () => ({ householdId: this.householdService.household()?.id }),
    loader: async ({ params }) => {
      if (!params.householdId) return [];
      return this.householdService.getMembers();
    },
  });

  readonly inviteUrl = signal<string | null>(null);
  readonly inviteLoading = signal(false);

  async generateInvite(): Promise<void> {
    this.inviteLoading.set(true);
    try {
      const token = await this.householdService.createInvite();
      this.inviteUrl.set(`${window.location.origin}/join/${token}`);
    } catch {
      this.snackBar.open('Impossible de générer le lien', undefined, { duration: 3000 });
    } finally {
      this.inviteLoading.set(false);
    }
  }

  async copyInviteUrl(): Promise<void> {
    const url = this.inviteUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    this.snackBar.open('Lien copié !', undefined, { duration: 2000 });
  }

  async shareInviteUrl(): Promise<void> {
    const url = this.inviteUrl();
    if (!url) return;
    await navigator.share({ title: 'BébéTrack — Rejoins notre foyer', url });
  }
}
