import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { of } from 'rxjs';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { StockComponent } from './stock.component';
import { StockService } from '../../core/stock/stock.service';
import { StockItem } from '../../core/stock/stock.models';
import { MOCK_MOVEMENT } from '../../core/stock/testing/stock-fixtures';

const MOCK_ITEM_LOW: StockItem = {
  id: 'item-1',
  household_id: 'hh-1',
  label: 'Couches',
  quantity: 0,
  alert_threshold: 3,
  auto_decrement_on_diaper: true,
  created_at: '2026-01-01T00:00:00Z',
};

const MOCK_ITEM_WARN: StockItem = {
  id: 'item-2',
  household_id: 'hh-1',
  label: 'Lingettes',
  quantity: 2,
  alert_threshold: 5,
  auto_decrement_on_diaper: false,
  created_at: '2026-01-01T00:00:00Z',
};

const MOCK_ITEM_OK: StockItem = {
  id: 'item-3',
  household_id: 'hh-1',
  label: 'Lait',
  quantity: 10,
  alert_threshold: 3,
  auto_decrement_on_diaper: false,
  created_at: '2026-01-01T00:00:00Z',
};

function makeStockServiceMock(items: StockItem[] = []) {
  const itemsValue = signal(items);
  return {
    items: {
      value: itemsValue.asReadonly(),
      isLoading: signal(false).asReadonly(),
      reload: vi.fn(),
    },
    addMovement: vi.fn().mockResolvedValue(MOCK_MOVEMENT),
    deleteMovement: vi.fn().mockResolvedValue(undefined),
    createItem: vi.fn().mockResolvedValue(undefined),
    updateItem: vi.fn().mockResolvedValue(undefined),
  } as unknown as StockService;
}

function makeDialogMock() {
  const afterClosed = vi.fn().mockReturnValue(of(undefined));
  const open = vi.fn().mockReturnValue({ afterClosed });
  return { open, afterClosed } as unknown as MatDialog;
}

async function configure(items: StockItem[] = []) {
  TestBed.resetTestingModule();

  const stockMock = makeStockServiceMock(items);
  const dialogMock = makeDialogMock();

  await TestBed.configureTestingModule({
    imports: [StockComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: StockService, useValue: stockMock },
      { provide: MatDialog, useValue: dialogMock },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(StockComponent);
  fixture.detectChanges();
  await fixture.whenStable();

  return { fixture, stockMock, dialogMock };
}

describe('StockComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('badge "Rupture" visible quand quantity <= 0', () => {
    it('affiche le badge Rupture quand quantity vaut 0', async () => {
      const { fixture } = await configure([MOCK_ITEM_LOW]);
      const badges = fixture.debugElement.queryAll(By.css('.badge-error'));
      expect(badges.length).toBeGreaterThan(0);
      expect(badges[0].nativeElement.textContent.trim()).toBe('Rupture');
    });
  });

  describe('badge "Stock bas" quand quantity <= alert_threshold', () => {
    it('affiche le badge Stock bas quand quantity est en dessous du seuil', async () => {
      const { fixture } = await configure([MOCK_ITEM_WARN]);
      const badges = fixture.debugElement.queryAll(By.css('.badge-warning'));
      expect(badges.length).toBeGreaterThan(0);
      expect(badges[0].nativeElement.textContent.trim()).toBe('Stock bas');
    });

    it("n'affiche aucun badge quand le stock est OK", async () => {
      const { fixture } = await configure([MOCK_ITEM_OK]);
      expect(fixture.debugElement.queryAll(By.css('.badge-error'))).toHaveLength(0);
      expect(fixture.debugElement.queryAll(By.css('.badge-warning'))).toHaveLength(0);
    });
  });

  describe('decrement() → appelle addMovement(-1)', () => {
    it('appelle addMovement avec delta=-1 et reason manual', async () => {
      const { fixture, stockMock } = await configure([MOCK_ITEM_OK]);
      await fixture.componentInstance.decrement(MOCK_ITEM_OK);
      expect(stockMock.addMovement).toHaveBeenCalledWith(MOCK_ITEM_OK.id, -1, 'manual');
    });
  });

  describe('increment() → appelle addMovement(+1)', () => {
    it('appelle addMovement avec delta=+1 et reason manual', async () => {
      const { fixture, stockMock } = await configure([MOCK_ITEM_OK]);
      await fixture.componentInstance.increment(MOCK_ITEM_OK);
      expect(stockMock.addMovement).toHaveBeenCalledWith(MOCK_ITEM_OK.id, 1, 'manual');
    });
  });
});
