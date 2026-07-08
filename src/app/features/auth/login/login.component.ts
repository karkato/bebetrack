import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormField, FormRoot, form, required, email as emailValidator } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SessionService } from '../../../core/auth/session.service';

interface LoginModel {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    FormRoot,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>BébéTrack</mat-card-title>
          <mat-card-subtitle>Connexion</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formRoot]="loginForm" (submit)="onSubmit($event)">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input
                matInput
                type="email"
                [formField]="loginForm.email"
                autocomplete="email"
              />
              @if (loginForm.email().touched() && loginForm.email().errors().length > 0) {
                <mat-error>{{ loginForm.email().errors()[0].message ?? 'Email invalide' }}</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Mot de passe</mat-label>
              <input
                matInput
                type="password"
                [formField]="loginForm.password"
                autocomplete="current-password"
              />
              @if (loginForm.password().touched() && loginForm.password().errors().length > 0) {
                <mat-error>{{ loginForm.password().errors()[0].message ?? 'Mot de passe requis' }}</mat-error>
              }
            </mat-form-field>

            @if (authError()) {
              <p class="auth-error">{{ authError() }}</p>
            }

            <button mat-flat-button type="submit" [disabled]="loading()">
              @if (loading()) {
                <mat-spinner diameter="20" />
              } @else {
                Se connecter
              }
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .login-container {
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
    form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 0;
    }
    .full-width {
      width: 100%;
    }
    .auth-error {
      color: var(--mat-sys-error);
      margin: 0;
      font-size: 0.875rem;
    }
    button[mat-flat-button] {
      width: 100%;
    }
  `,
})
export class LoginComponent {
  private readonly sessionService = inject(SessionService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly authError = signal<string | null>(null);

  private readonly model = signal<LoginModel>({ email: '', password: '' });

  readonly loginForm = form(this.model, (f) => {
    required(f.email);
    emailValidator(f.email);
    required(f.password);
  });

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();

    this.loginForm().markAsTouched();

    if (this.loginForm().invalid()) return;

    this.loading.set(true);
    this.authError.set(null);

    try {
      const { email, password } = this.model();
      await this.sessionService.signIn(email, password);

      const redirectUrl = this.activatedRoute.snapshot.queryParamMap.get('redirect') ?? '/';
      await this.router.navigateByUrl(redirectUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      this.authError.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
