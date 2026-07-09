export type FeedingType = 'breast_left' | 'breast_right' | 'bottle';

export interface Feeding {
  id: string;
  baby_id: string;
  started_at: string;
  ended_at: string | null;
  type: FeedingType;
  amount_ml: number | null;
  created_by: string;
  created_at: string;
}
