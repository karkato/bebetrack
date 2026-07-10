import { Injectable, inject, resource } from '@angular/core';
import { BabyService } from '../baby/baby.service';
import { SessionService } from '../auth/session.service';
import { SupabaseService } from '../supabase.service';
import { Feeding } from './feeding.models';

@Injectable({ providedIn: 'root' })
export class FeedingService {
  private readonly supabase = inject(SupabaseService);
  private readonly baby = inject(BabyService);
  private readonly sessionService = inject(SessionService);

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

  readonly ongoingFeeding = resource({
    params: () => this.baby.currentBaby()?.id ?? null,
    loader: async ({ params: babyId }) => {
      if (!babyId) return null as Feeding | null;
      const { data } = await this.supabase.client
        .from('feedings')
        .select('*')
        .eq('baby_id', babyId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as Feeding | null;
    },
  });

  async startFeeding(babyId: string, side: 'breast_left' | 'breast_right'): Promise<Feeding> {
    const userId = this.sessionService.user()?.id;
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await this.supabase.client
      .from('feedings')
      .insert({ baby_id: babyId, type: side, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    return data as Feeding;
  }

  async stopFeeding(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('feedings')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async recordBottleFeeding(babyId: string, amountMl: number): Promise<Feeding> {
    const userId = this.sessionService.user()?.id;
    if (!userId) throw new Error('Not authenticated');
    const now = new Date().toISOString();
    const { data, error } = await this.supabase.client
      .from('feedings')
      .insert({
        baby_id: babyId,
        type: 'bottle',
        amount_ml: amountMl,
        started_at: now,
        ended_at: now,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Feeding;
  }
}
