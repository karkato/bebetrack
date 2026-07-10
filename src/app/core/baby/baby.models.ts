export type FeedingPreference = 'breast' | 'bottle' | 'mixed';

export interface Baby {
  id: string;
  household_id: string;
  name: string;
  birth_date: string;
  feeding_preference: FeedingPreference;
  created_at: string;
}
