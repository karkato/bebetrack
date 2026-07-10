import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi, describe, it, expect } from 'vitest';
import { BabyService } from './baby.service';
import { SupabaseService } from '../supabase.service';
import { HouseholdService } from '../household/household.service';
import { Baby } from './baby.models';
import { makeHouseholdMock } from '../household/testing/household-mock';

function makeSupabaseMock(babies: Baby[] = []) {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: babies, error: null }),
  };
  const insertChain = {
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === 'babies') return { ...selectChain, ...insertChain };
        return selectChain;
      }),
    },
  } as unknown as SupabaseService;
}

describe('BabyService', () => {
  describe('babies resource — retourne [] si pas de foyer', () => {
    it('value est [] quand household est null', async () => {
      const supabaseMock = makeSupabaseMock();
      const householdMock = makeHouseholdMock(null);

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: HouseholdService, useValue: householdMock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(BabyService);
      // resource with null householdId returns [] immediately (no loader call)
      // Wait for resource to settle
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(svc.babies.value()).toEqual([]);
      expect(supabaseMock.client.from).not.toHaveBeenCalled();
    });
  });

  describe('currentBaby() est le premier bébé', () => {
    it('retourne null si la liste est vide', async () => {
      const supabaseMock = makeSupabaseMock([]);
      const householdMock = makeHouseholdMock({ id: 'hh-1', name: 'Test', created_at: '' });

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: HouseholdService, useValue: householdMock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(BabyService);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(svc.currentBaby()).toBeNull();
    });

    it('retourne le premier bébé si la liste en contient', async () => {
      const baby: Baby = {
        id: 'b-1',
        household_id: 'hh-1',
        name: 'Léa',
        birth_date: '2026-01-01',
        feeding_preference: 'mixed',
        created_at: '',
      };
      const supabaseMock = makeSupabaseMock([baby]);
      const householdMock = makeHouseholdMock({ id: 'hh-1', name: 'Test', created_at: '' });

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: HouseholdService, useValue: householdMock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(BabyService);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(svc.currentBaby()).toEqual(baby);
    });
  });

  describe('createBaby — insère dans Supabase et recharge', () => {
    it('appelle insert avec les bons champs et appelle reload', async () => {
      const MOCK_BABY_CREATED: Baby = {
        id: 'b-new',
        household_id: 'hh-42',
        name: 'Léa',
        birth_date: '2026-01-01',
        feeding_preference: 'mixed',
        created_at: '',
      };
      const singleFn = vi.fn().mockResolvedValue({ data: MOCK_BABY_CREATED, error: null });
      const insertSelectFn = vi.fn().mockReturnValue({ single: singleFn });
      const insertFn = vi.fn().mockReturnValue({ select: insertSelectFn });
      const fromFn = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: insertFn,
      });
      const supabaseMock = { client: { from: fromFn } } as unknown as SupabaseService;
      const householdMock = makeHouseholdMock({ id: 'hh-42', name: 'Test', created_at: '' });

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: HouseholdService, useValue: householdMock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(BabyService);
      const reloadSpy = vi.spyOn(svc.babies, 'reload');

      const result = await svc.createBaby('Léa', '2026-01-01', 'mixed');

      expect(insertFn).toHaveBeenCalledWith({
        household_id: 'hh-42',
        name: 'Léa',
        birth_date: '2026-01-01',
        feeding_preference: 'mixed',
      });
      expect(reloadSpy).toHaveBeenCalled();
      expect(result).toEqual(MOCK_BABY_CREATED);
    });

    it('lève une erreur si pas de foyer', async () => {
      const supabaseMock = makeSupabaseMock();
      const householdMock = makeHouseholdMock(null);

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: HouseholdService, useValue: householdMock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(BabyService);
      await expect(svc.createBaby('Léa', '2026-01-01', 'mixed')).rejects.toThrow('No household');
    });
  });
});
