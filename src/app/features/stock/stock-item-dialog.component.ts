import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormField, form, schema, required, min } from '@angular/forms/signals';
import { StockItem } from '../../core/stock/stock.models';

export interface StockItemDialogData {
  item?: StockItem;
}

export interface StockItemDialogResult {
  label: string;
  alert_threshold: number;
  auto_decrement_on_diaper: boolean;
  initial_quantity: number;
}

interface StockItemFormModel {
  label: string;
  alert_threshold: number;
  initial_quantity: number;
}

@Component({
  selector: 'app-stock-item-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    FormField,
  ],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Modifier le produit' : 'Nouveau produit' }}</h2>

    <mat-dialog-content>
      <form id="stock-item-form" (submit)="onSubmit($event)" class="dialog-form">

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nom du produit</mat-label>
          <input matInput type="text" [formField]="stockForm.label" placeholder="ex: Couches taille 2" />
          @if (stockForm.label().touched() && stockForm.label().errors().length > 0) {
            <mat-error>{{ stockForm.label().errors()[0].message ?? 'Nom requis' }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Seuil d'alerte</mat-label>
          <input matInput type="number" [formField]="stockForm.alert_threshold" />
          @if (stockForm.alert_threshold().touched() && stockForm.alert_threshold().errors().length > 0) {
            <mat-error>{{ stockForm.alert_threshold().errors()[0].message ?? 'Valeur invalide' }}</mat-error>
          }
        </mat-form-field>

        @if (!isEdit) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Quantité initiale</mat-label>
            <input matInput type="number" [formField]="stockForm.initial_quantity" />
            @if (stockForm.initial_quantity().touched() && stockForm.initial_quantity().errors().length > 0) {
              <mat-error>{{ stockForm.initial_quantity().errors()[0].message ?? 'Valeur invalide' }}</mat-error>
            }
          </mat-form-field>
        }

        <div class="checkbox-row">
          <mat-checkbox
            [checked]="autoDecrement()"
            (change)="autoDecrement.set($event.checked)"
          >
            Décrémenter automatiquement lors d'une couche
          </mat-checkbox>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Annuler</button>
      <button mat-flat-button type="submit" form="stock-item-form">Enregistrer</button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 8px 0;
      min-width: 320px;
    }

    .full-width {
      width: 100%;
    }

    .checkbox-row {
      padding: 4px 0;
    }
  `,
})
export class StockItemDialogComponent {
  readonly dialogRef = inject(MatDialogRef<StockItemDialogComponent>);
  private readonly data = inject<StockItemDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data.item;

  // Boolean field not in Signal Forms model — managed as a plain signal
  readonly autoDecrement = signal(this.data.item?.auto_decrement_on_diaper ?? false);

  private readonly model = signal<StockItemFormModel>({
    label: this.data.item?.label ?? '',
    alert_threshold: this.data.item?.alert_threshold ?? 0,
    initial_quantity: 0,
  });

  readonly stockForm = form(
    this.model,
    schema<StockItemFormModel>(f => {
      required(f.label);
      min(f.alert_threshold, 0);
      min(f.initial_quantity, 0);
    }),
  );

  onSubmit(event: Event): void {
    event.preventDefault();
    this.stockForm().markAsTouched();
    if (this.stockForm().invalid()) return;

    const value = this.model();
    const result: StockItemDialogResult = {
      label: value.label.trim(),
      alert_threshold: value.alert_threshold,
      auto_decrement_on_diaper: this.autoDecrement(),
      initial_quantity: this.isEdit ? 0 : value.initial_quantity,
    };
    this.dialogRef.close(result);
  }
}
