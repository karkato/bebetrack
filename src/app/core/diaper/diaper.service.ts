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

    // Attempt atomic RPC: insert diaper + auto-decrement stock
    // If RPC fails (unavailable or stock error), fall through to direct insert
    let rpcDiaperId: string | null = null;
    try {
      const { data, error } = await this.supabase.client.rpc('record_diaper_with_stock', {
        p_baby_id: babyId,
        p_kind: kind,
      });
      if (!error && data) {
        rpcDiaperId = (data as { diaper_id: string }).diaper_id;
      }
    } catch {
      // RPC unavailable — fall through to direct insert
    }

    if (rpcDiaperId) {
      // RPC succeeded: fetch the created diaper (throws if fetch fails — no double insert)
      const { data, error } = await this.supabase.client
        .from('diapers')
        .select('*')
        .eq('id', rpcDiaperId)
        .single();
      if (error) throw error;
      return data as Diaper;
    }

    // Fallback: insert diaper directly (stock not decremented)
    const { data, error } = await this.supabase.client
      .from('diapers')
      .insert({ baby_id: babyId, kind, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    return data as Diaper;
  }

  async deleteDiaper(id: string): Promise<void> {
    // Use symmetric RPC to also clean up diaper_auto stock movements
    try {
      const { error } = await this.supabase.client.rpc('delete_diaper_with_stock', {
        p_diaper_id: id,
      });
      if (error) throw error;
    } catch {
      // Fallback: delete diaper only
      await this.supabase.client.from('diapers').delete().eq('id', id);
    }
  }
}
