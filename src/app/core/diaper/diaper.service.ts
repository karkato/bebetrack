import { Injectable, inject, signal, effect } from '@angular/core';
import { SessionService } from '../auth/session.service';
import { SupabaseService } from '../supabase.service';
import { BabyService } from '../baby/baby.service';
import { RealtimeService } from '../realtime/realtime.service';
import { RealtimeSubscription } from '../realtime/realtime.models';
import { Diaper, DiaperKind } from './diaper.models';

@Injectable({ providedIn: 'root' })
export class DiaperService {
  private readonly supabase = inject(SupabaseService);
  private readonly session = inject(SessionService);
  private readonly baby = inject(BabyService);
  private readonly realtimeService = inject(RealtimeService);
  private diaperSubscription: RealtimeSubscription | null = null;

  readonly diaperInvalidated = signal(0);

  constructor() {
    effect(() => {
      const babyId = this.baby.currentBaby()?.id;

      this.diaperSubscription?.unsubscribe();
      this.diaperSubscription = null;

      if (!babyId) return;

      this.diaperSubscription = this.realtimeService.subscribe(
        `diapers-baby-${babyId}`,
        'diapers',
        `baby_id=eq.${babyId}`,
        () => {
          this.diaperInvalidated.update(n => n + 1);
        },
      );
    });
  }

  async createDiaper(babyId: string, kind: DiaperKind): Promise<Diaper> {
    const userId = this.session.user()?.id;
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await this.supabase.client
      .from('diapers')
      .insert({ baby_id: babyId, kind, at: new Date().toISOString(), created_by: userId })
      .select()
      .single();
    if (error) throw error;
    return data as Diaper;
  }

  async deleteDiaper(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('diapers')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
