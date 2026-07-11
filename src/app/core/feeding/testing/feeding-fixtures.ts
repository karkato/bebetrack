import type { Feeding } from '../feeding.models';

export const MOCK_FEEDING: Feeding = {
  id: 'f-1',
  baby_id: 'b-1',
  started_at: '2026-01-01T08:00:00Z',
  ended_at: '2026-01-01T08:20:00Z',
  type: 'breast_left',
  amount_ml: null,
  created_by: 'user-1',
  created_at: '2026-01-01T08:00:00Z',
};
