import { Injectable, inject, computed, resource } from '@angular/core';
import { HouseholdService } from '../household/household.service';
import { SupabaseService } from '../supabase.service';
import { Baby, FeedingPreference } from './baby.models';

@Injectable({ providedIn: 'root' })
export class BabyService {
  private readonly supabase = inject(SupabaseService);
  private readonly household = inject(HouseholdService);

  readonly babies = resource({
    params: () => ({ householdId: this.household.household()?.id ?? null }),
    loader: async ({ params }) => {
      if (!params.householdId) return [] as Baby[];
      const { data } = await this.supabase.client
        .from('babies')
        .select('*')
        .eq('household_id', params.householdId)
        .order('created_at', { ascending: true });
      return (data ?? []) as Baby[];
    },
  });

  readonly currentBaby = computed(() => this.babies.value()?.[0] ?? null);

  async createBaby(name: string, birthDate: string, preference: FeedingPreference): Promise<Baby> {
    const householdId = this.household.household()?.id;
    if (!householdId) throw new Error('No household');
    const { data, error } = await this.supabase.client
      .from('babies')
      .insert({ household_id: householdId, name, birth_date: birthDate, feeding_preference: preference })
      .select()
      .single();
    if (error) throw error;
    this.babies.reload();
    return data as Baby;
  }
}
