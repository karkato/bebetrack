import type { StockItem, StockMovement } from '../stock.models';

export const MOCK_ITEM: StockItem = {
  id: 'item-1',
  household_id: 'hh-1',
  label: 'Couches',
  quantity: 10,
  alert_threshold: 3,
  auto_decrement_on_diaper: true,
  created_at: '2026-01-01T00:00:00Z',
};

export const MOCK_MOVEMENT: StockMovement = {
  id: 'mov-1',
  stock_item_id: 'item-1',
  delta: -1,
  reason: 'manual',
  at: '2026-01-01T00:00:00Z',
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
};
