import { Injectable, inject } from '@angular/core';
import { SessionService } from '../auth/session.service';
import { SupabaseService } from '../supabase.service';
import { Diaper, DiaperKind } from './diaper.models';

@Injectable({ providedIn: 'root' })
export class DiaperService {
  private readonly supabase = inject(SupabaseService);
  private readonly session = inject(SessionService);

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
