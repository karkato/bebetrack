import type { Baby } from '../baby.models';

export const MOCK_BABY: Baby = {
  id: 'b-1',
  household_id: 'hh-1',
  name: 'Léa',
  birth_date: '2026-01-01',
  feeding_preference: 'mixed',
  created_at: '',
};

export const MOCK_BABY_B: Baby = {
  id: 'b-2',
  household_id: 'hh-1',
  name: 'Tom',
  birth_date: '2026-02-01',
  feeding_preference: 'bottle',
  created_at: '',
};
