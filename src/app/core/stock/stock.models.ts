export type StockMovementReason = 'manual' | 'diaper_auto' | 'restock';

export interface StockItem {
  id: string;
  household_id: string;
  label: string;
  quantity: number;
  alert_threshold: number;
  auto_decrement_on_diaper: boolean;
  created_at: string;
}

export interface StockMovement {
  id: string;
  stock_item_id: string;
  delta: number;
  reason: StockMovementReason;
  at: string;
  created_by: string;
  created_at: string;
}
