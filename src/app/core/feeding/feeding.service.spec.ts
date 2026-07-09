import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, computed } from '@angular/core';
import { vi, describe, it, expect } from 'vitest';
import { FeedingService } from './feeding.service';
import { SupabaseService } from '../supabase.service';
import { BabyService } from '../baby/baby.service';
import { Feeding } from './feeding.models';
import { Baby } from '../baby/baby.models';

const MOCK_FEEDING: Feeding = {
  id: 'f-1',
  baby_id: 'b-1',
  started_at: '2026-01-01T08:00:00Z',
  ended_at: '2026-01-01T08:20:00Z',
  type: 'breast_left',
  amount_ml: null,
  created_by: 'user-1',
  created_at: '2026-01-01T08:00:00Z',
};

function makeSupabaseMock(returnedFeeding: Feeding | null) {
  const maybeSingleFn = vi.fn().mockResolvedValue({ data: returnedFeeding, error: null });
  const limitFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
  const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
  const eqFn = vi.fn().mockReturnValue({ order: orderFn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
  return {
    client: {
      from: vi.fn().mockReturnValue({ select: selectFn }),
    },
  } as unknown as SupabaseService;
}

function makeBabyMock(baby: Baby | null) {
  const babySignal = signal(baby);
  return {
    currentBaby: babySignal.asReadonly(),
  } as unknown as BabyService;
}

describe('FeedingService', () => {
  describe('lastFeeding resource — retourne null si pas de bébé', () => {
    it('ne déclenche pas de requête et retourne undefined quand currentBaby est null', async () => {
      const supabaseMock = makeSupabaseMock(null);
      const babyMock = makeBabyMock(null);

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: BabyService, useValue: babyMock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(FeedingService);
      await new Promise(resolve => setTimeout(resolve, 0));
      // When babyId is null the loader returns null immediately
      expect(supabaseMock.client.from).not.toHaveBeenCalled();
    });
  });

  describe('lastFeeding resource — charge la dernière tétée', () => {
    it('appelle Supabase avec le bon baby_id et retourne la tétée', async () => {
      const baby: Baby = {
        id: 'b-1',
        household_id: 'hh-1',
        name: 'Léa',
        birth_date: '2026-01-01',
        created_at: '',
      };
      const supabaseMock = makeSupabaseMock(MOCK_FEEDING);
      const babyMock = makeBabyMock(baby);

      await TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: BabyService, useValue: babyMock },
        ],
      }).compileComponents();

      const svc = TestBed.inject(FeedingService);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(supabaseMock.client.from).toHaveBeenCalledWith('feedings');
      expect(svc.lastFeeding.value()).toEqual(MOCK_FEEDING);
    });
  });
});
