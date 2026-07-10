import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { StockService } from '../../core/stock/stock.service';
import { StockItem } from '../../core/stock/stock.models';
import {
  StockItemDialogComponent,
  StockItemDialogData,
  StockItemDialogResult,
} from './stock-item-dialog.component';

@Component({
  selector: 'app-stock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatBadgeModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  template: `
    <div class="stock-container">
      <header class="stock-header">
        <h1>Stock</h1>
        <button mat-fab (click)="openCreateDialog()" aria-label="Ajouter un produit">
          <mat-icon>add</mat-icon>
        </button>
      </header>

      @if (stockService.items.isLoading()) {
        <p class="loading">Chargement…</p>
      } @else if ((stockService.items.value() ?? []).length === 0) {
        <p class="empty">Aucun produit en stock. Ajoutez votre premier produit.</p>
      } @else {
        <mat-list>
          @for (item of stockService.items.value() ?? []; track item.id) {
            <mat-list-item class="stock-item">
              <span matListItemTitle class="item-label">{{ item.label }}</span>
              <span matListItemLine class="item-qty">
                Quantité : {{ item.quantity }}
                @if (item.quantity <= 0) {
                  <span class="badge badge-error">Rupture</span>
                } @else if (item.quantity <= item.alert_threshold) {
                  <span class="badge badge-warning">Stock bas</span>
                }
              </span>
              <div matListItemMeta class="item-actions">
                <button mat-icon-button (click)="decrement(item)" aria-label="Décrémenter">
                  <mat-icon>remove</mat-icon>
                </button>
                <button mat-icon-button (click)="increment(item)" aria-label="Incrémenter">
                  <mat-icon>add</mat-icon>
                </button>
                <button mat-icon-button (click)="openEditDialog(item)" aria-label="Modifier">
                  <mat-icon>edit</mat-icon>
                </button>
              </div>
            </mat-list-item>
          }
        </mat-list>
      }
    </div>
  `,
  styles: `
    .stock-container {
      padding: 16px;
      max-width: 600px;
      margin: 0 auto;
    }

    .stock-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .stock-header h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .loading,
    .empty {
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
      padding: 32px 16px;
    }

    .item-label {
      font-weight: 500;
    }

    .item-qty {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge-error {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }

    .badge-warning {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }

    .item-actions {
      display: flex;
      gap: 4px;
    }
  `,
})
export class StockComponent {
  readonly stockService = inject(StockService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  async decrement(item: StockItem): Promise<void> {
    try {
      const movement = await this.stockService.addMovement(item.id, -1, 'manual');
      const ref = this.snackBar.open('Stock mis à jour', 'Annuler', { duration: 5000 });
      ref.onAction().subscribe(() => {
        this.stockService.deleteMovement(movement.id).catch(() => {
          this.snackBar.open('Annulation impossible', undefined, { duration: 3000 });
        });
      });
    } catch {
      this.snackBar.open('Erreur lors de la mise à jour', undefined, { duration: 3000 });
    }
  }

  async increment(item: StockItem): Promise<void> {
    try {
      const movement = await this.stockService.addMovement(item.id, 1, 'manual');
      const ref = this.snackBar.open('Stock mis à jour', 'Annuler', { duration: 5000 });
      ref.onAction().subscribe(() => {
        this.stockService.deleteMovement(movement.id).catch(() => {
          this.snackBar.open('Annulation impossible', undefined, { duration: 3000 });
        });
      });
    } catch {
      this.snackBar.open('Erreur lors de la mise à jour', undefined, { duration: 3000 });
    }
  }

  openCreateDialog(): void {
    const ref = this.dialog.open<StockItemDialogComponent, StockItemDialogData, StockItemDialogResult>(
      StockItemDialogComponent,
      { data: { item: undefined }, width: '400px' },
    );
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.stockService
        .createItem(result.label, result.alert_threshold, result.auto_decrement_on_diaper, result.initial_quantity)
        .catch(() => {
          this.snackBar.open('Erreur lors de la création', undefined, { duration: 3000 });
        });
    });
  }

  openEditDialog(item: StockItem): void {
    const ref = this.dialog.open<StockItemDialogComponent, StockItemDialogData, StockItemDialogResult>(
      StockItemDialogComponent,
      { data: { item }, width: '400px' },
    );
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.stockService
        .updateItem(item.id, {
          label: result.label,
          alert_threshold: result.alert_threshold,
          auto_decrement_on_diaper: result.auto_decrement_on_diaper,
        })
        .catch(() => {
          this.snackBar.open('Erreur lors de la mise à jour', undefined, { duration: 3000 });
        });
    });
  }
}
