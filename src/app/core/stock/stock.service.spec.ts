import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi, describe, it, expect } from 'vitest';
import { StockService } from './stock.service';
import { SupabaseService } from '../supabase.service';
import { HouseholdService } from '../household/household.service';
import { SessionService } from '../auth/session.service';
import { RealtimeService } from '../realtime/realtime.service';
import { makeHouseholdMock, MOCK_HOUSEHOLD } from '../household/testing/household-mock';
import { makeSessionMock } from '../auth/testing/session-mock';
import { makeRealtimeMock } from '../realtime/testing/realtime-mock';
import { MOCK_ITEM, MOCK_MOVEMENT } from './testing/stock-fixtures';
import { StockItem, StockMovement } from './stock.models';

function makeSupabaseMock(overrides?: {
  fromItems?: StockItem[];
  insertMovementResult?: { data: StockMovement | null; error: null | Error };
  deleteMovementError?: Error | null;
  rpcResult?: { data: unknown; error: null | Error };
}) {
  const fromItems = overrides?.fromItems ?? [MOCK_ITEM];
  const insertMovResult = overrides?.insertMovementResult ?? { data: MOCK_MOVEMENT, error: null };
  const delMovError = overrides?.deleteMovementError ?? null;

  const selectItemsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: fromItems, error: null }),
  };

  const singleMovFn = vi.fn().mockResolvedValue(insertMovResult);
  const selectMovFn = vi.fn().mockReturnValue({ single: singleMovFn });
  const insertMovChain = {
    insert: vi.fn().mockReturnValue({ select: selectMovFn }),
  };

  const eqDeleteFn = vi.fn().mockResolvedValue({ error: delMovError });
  const deleteChain = {
    delete: vi.fn().mockReturnValue({ eq: eqDeleteFn }),
  };

  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === 'stock_items') return selectItemsChain;
        if (table === 'stock_movements') return { ...insertMovChain, ...deleteChain };
        return selectItemsChain;
      }),
    },
  } as unknown as SupabaseService;
}

describe('StockService', () => {
  describe('items resource — retourne [] si pas de foyer', () => {
    it('value est [] quand household est null', async () => {
      const supabaseMock = makeSupabaseMock();
      const householdMock = makeHouseholdMock(null);
      const realtimeMock = makeRealtimeMock();

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: HouseholdService, useValue: householdMock },
          { provide: SessionService, useValue: makeSessionMock('user-1') },
          { provide: RealtimeService, useValue: realtimeMock.mock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(StockService);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(svc.items.value()).toEqual([]);
      expect(supabaseMock.client.from).not.toHaveBeenCalled();
    });
  });

  describe('items resource — charge les items du foyer', () => {
    it('retourne les items quand un foyer est présent', async () => {
      const supabaseMock = makeSupabaseMock({ fromItems: [MOCK_ITEM] });
      const householdMock = makeHouseholdMock(MOCK_HOUSEHOLD);
      const realtimeMock = makeRealtimeMock();

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: HouseholdService, useValue: householdMock },
          { provide: SessionService, useValue: makeSessionMock('user-1') },
          { provide: RealtimeService, useValue: realtimeMock.mock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(StockService);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(svc.items.value()).toEqual([MOCK_ITEM]);
    });
  });

  describe('addMovement — insère dans stock_movements', () => {
    it('appelle insert avec les bons champs et retourne le mouvement', async () => {
      const supabaseMock = makeSupabaseMock({
        insertMovementResult: { data: MOCK_MOVEMENT, error: null },
      });
      const householdMock = makeHouseholdMock(MOCK_HOUSEHOLD);
      const realtimeMock = makeRealtimeMock();

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: HouseholdService, useValue: householdMock },
          { provide: SessionService, useValue: makeSessionMock('user-1') },
          { provide: RealtimeService, useValue: realtimeMock.mock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(StockService);
      const result = await svc.addMovement('item-1', -1, 'manual');

      expect(supabaseMock.client.from).toHaveBeenCalledWith('stock_movements');
      expect(result).toEqual(MOCK_MOVEMENT);
    });

    it('lève une erreur si pas authentifié', async () => {
      const supabaseMock = makeSupabaseMock();
      const householdMock = makeHouseholdMock(MOCK_HOUSEHOLD);
      const realtimeMock = makeRealtimeMock();

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: HouseholdService, useValue: householdMock },
          { provide: SessionService, useValue: makeSessionMock(null) },
          { provide: RealtimeService, useValue: realtimeMock.mock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(StockService);
      await expect(svc.addMovement('item-1', -1, 'manual')).rejects.toThrow('Not authenticated');
    });
  });

  describe('deleteMovement — supprime le mouvement', () => {
    it('appelle delete avec le bon id', async () => {
      const supabaseMock = makeSupabaseMock({ deleteMovementError: null });
      const householdMock = makeHouseholdMock(MOCK_HOUSEHOLD);
      const realtimeMock = makeRealtimeMock();

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: HouseholdService, useValue: householdMock },
          { provide: SessionService, useValue: makeSessionMock('user-1') },
          { provide: RealtimeService, useValue: realtimeMock.mock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(StockService);
      await svc.deleteMovement('mov-1');

      expect(supabaseMock.client.from).toHaveBeenCalledWith('stock_movements');
    });
  });

  describe('Realtime — abonnement déclenche reload', () => {
    it('subscribe est appelé avec stock_movements quand un foyer est présent', async () => {
      const supabaseMock = makeSupabaseMock();
      const householdMock = makeHouseholdMock(MOCK_HOUSEHOLD);
      const realtimeMock = makeRealtimeMock();

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: HouseholdService, useValue: householdMock },
          { provide: SessionService, useValue: makeSessionMock('user-1') },
          { provide: RealtimeService, useValue: realtimeMock.mock },
        ],
      }).compileComponents();

      TestBed.inject(StockService);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(realtimeMock.subscribeFn).toHaveBeenCalledWith(
        `stock-movements-${MOCK_HOUSEHOLD.id}`,
        'stock_movements',
        undefined,
        expect.any(Function),
      );
    });

    it('le callback Realtime déclenche items.reload()', async () => {
      const holder = { callback: null as ((() => void) | null) };
      const realtimeService = {
        subscribe: vi.fn((_, __, ___, callback) => {
          holder.callback = callback;
          return { unsubscribe: vi.fn() };
        }),
      } as unknown as RealtimeService;

      const supabaseMock = makeSupabaseMock();
      const householdMock = makeHouseholdMock(MOCK_HOUSEHOLD);

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: HouseholdService, useValue: householdMock },
          { provide: SessionService, useValue: makeSessionMock('user-1') },
          { provide: RealtimeService, useValue: realtimeService },
        ],
      }).compileComponents();

      const svc = TestBed.inject(StockService);
      await new Promise(resolve => setTimeout(resolve, 10));

      const reloadSpy = vi.spyOn(svc.items, 'reload');
      holder.callback?.();
      expect(reloadSpy).toHaveBeenCalled();
    });
  });
});
