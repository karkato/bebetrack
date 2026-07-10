import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi, describe, it, expect } from 'vitest';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { StockItemDialogComponent, StockItemDialogData } from './stock-item-dialog.component';
import { MOCK_ITEM } from '../../core/stock/testing/stock-fixtures';

function makeDialogRefMock() {
  return { close: vi.fn() } as unknown as MatDialogRef<StockItemDialogComponent>;
}

async function configureDialog(data: StockItemDialogData) {
  TestBed.resetTestingModule();

  const dialogRefMock = makeDialogRefMock();

  await TestBed.configureTestingModule({
    imports: [StockItemDialogComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRefMock },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(StockItemDialogComponent);
  fixture.detectChanges();
  await fixture.whenStable();

  return { fixture, dialogRefMock };
}

describe('StockItemDialogComponent', () => {
  describe('formulaire de création — submit appelle dialogRef.close avec les bonnes données', () => {
    it('ferme avec les données saisies', async () => {
      const { fixture, dialogRefMock } = await configureDialog({ item: undefined });
      const component = fixture.componentInstance;

      // Set form values via model signal
      component['model'].set({ label: 'Couches T2', alert_threshold: 5, initial_quantity: 10 });
      component.autoDecrement.set(true);
      fixture.detectChanges();

      const form = fixture.debugElement.query(By.css('form'));
      form.nativeElement.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(dialogRefMock.close).toHaveBeenCalledWith({
        label: 'Couches T2',
        alert_threshold: 5,
        auto_decrement_on_diaper: true,
        initial_quantity: 10,
      });
    });

    it('n\'appelle pas close si le label est vide', async () => {
      const { fixture, dialogRefMock } = await configureDialog({ item: undefined });
      const component = fixture.componentInstance;

      // Label vide — validation doit échouer
      component['model'].set({ label: '', alert_threshold: 0, initial_quantity: 0 });
      fixture.detectChanges();

      const form = fixture.debugElement.query(By.css('form'));
      form.nativeElement.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });
  });

  describe('formulaire d\'édition — champs pré-remplis avec l\'item existant', () => {
    it('pré-remplit les champs avec les valeurs de l\'item', async () => {
      const { fixture } = await configureDialog({ item: MOCK_ITEM });
      const component = fixture.componentInstance;

      expect(component.isEdit).toBe(true);
      expect(component['model']().label).toBe(MOCK_ITEM.label);
      expect(component['model']().alert_threshold).toBe(MOCK_ITEM.alert_threshold);
      expect(component.autoDecrement()).toBe(MOCK_ITEM.auto_decrement_on_diaper);
    });

    it('ferme avec initial_quantity=0 en mode édition', async () => {
      const { fixture, dialogRefMock } = await configureDialog({ item: MOCK_ITEM });
      const component = fixture.componentInstance;

      component['model'].set({ label: 'Couches Updated', alert_threshold: 3, initial_quantity: 99 });
      component.autoDecrement.set(false);
      fixture.detectChanges();

      const form = fixture.debugElement.query(By.css('form'));
      form.nativeElement.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(dialogRefMock.close).toHaveBeenCalledWith({
        label: 'Couches Updated',
        alert_threshold: 3,
        auto_decrement_on_diaper: false,
        initial_quantity: 0, // toujours 0 en mode édition
      });
    });
  });
});
