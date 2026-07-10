import { Injectable, inject, signal, effect } from '@angular/core';
import { SessionService } from '../auth/session.service';
import { SupabaseService } from '../supabase.service';
import { BabyService } from '../baby/baby.service';
import { RealtimeService } from '../realtime/realtime.service';
import { Diaper, DiaperKind } from './diaper.models';

@Injectable({ providedIn: 'root' })
export class DiaperService {
  private readonly supabase = inject(SupabaseService);
  private readonly session = inject(SessionService);
  private readonly baby = inject(BabyService);
  private readonly realtimeService = inject(RealtimeService);

  // Mi1: private writable signal, expose readonly
  private readonly _diaperInvalidated = signal(0);
  readonly diaperInvalidated = this._diaperInvalidated.asReadonly();

  constructor() {
    // M3: use onCleanup for robust subscription lifecycle management
    effect((onCleanup) => {
      const babyId = this.baby.currentBaby()?.id;
      if (!babyId) return;

      const subscription = this.realtimeService.subscribe(
        `diapers-baby-${babyId}`,
        'diapers',
        `baby_id=eq.${babyId}`,
        () => {
          this._diaperInvalidated.update(n => n + 1);
        },
      );

      onCleanup(() => subscription.unsubscribe());
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
