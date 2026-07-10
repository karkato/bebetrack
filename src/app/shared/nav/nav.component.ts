import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="bottom-nav">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
        <span class="nav-icon">home</span>
        <span class="nav-label">Accueil</span>
      </a>
      <a routerLink="/stock" routerLinkActive="active">
        <span class="nav-icon">inventory_2</span>
        <span class="nav-label">Stock</span>
      </a>
      <a routerLink="/timeline" routerLinkActive="active">
        <span class="nav-icon">timeline</span>
        <span class="nav-label">Timeline</span>
      </a>
    </nav>
  `,
  styles: `
    .bottom-nav {
      display: flex;
      justify-content: space-around;
      align-items: center;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 64px;
      background: var(--mat-sys-surface-container);
      border-top: 1px solid var(--mat-sys-outline-variant);
      z-index: 100;
    }

    .bottom-nav a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      flex: 1;
      height: 100%;
      text-decoration: none;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.75rem;
      transition: color 0.15s;
    }

    .bottom-nav a.active {
      color: var(--mat-sys-primary);
    }

    .nav-icon {
      font-family: 'Material Symbols Outlined', sans-serif;
      font-size: 1.5rem;
      line-height: 1;
    }

    .nav-label {
      font-size: 0.7rem;
      font-weight: 500;
    }
  `,
})
export class NavComponent {}
