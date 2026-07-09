import { Injectable, inject, resource } from '@angular/core';
import { BabyService } from '../baby/baby.service';
import { SupabaseService } from '../supabase.service';
import { Feeding } from './feeding.models';

@Injectable({ providedIn: 'root' })
export class FeedingService {
  private readonly supabase = inject(SupabaseService);
  private readonly baby = inject(BabyService);

  readonly lastFeeding = resource({
    params: () => ({ babyId: this.baby.currentBaby()?.id ?? null }),
    loader: async ({ params }) => {
      if (!params.babyId) return null as Feeding | null;
      const { data } = await this.supabase.client
        .from('feedings')
        .select('*')
        .eq('baby_id', params.babyId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as Feeding | null;
    },
  });
}
