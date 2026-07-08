import { Injectable, inject, signal, computed } from '@angular/core';
import { SessionService } from '../auth/session.service';
import { SupabaseService } from '../supabase.service';
import { Household } from './household.models';

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private readonly supabase = inject(SupabaseService);
  private readonly session = inject(SessionService);

  private readonly _household = signal<Household | null>(null);
  readonly household = this._household.asReadonly();
  readonly hasHousehold = computed(() => this._household() !== null);

  async initialize(): Promise<void> {
    if (!this.session.isAuthenticated()) return;
    await this.loadCurrentHousehold();
  }

  async loadCurrentHousehold(): Promise<void> {
    const { data } = await this.supabase.client
      .from('households')
      .select('*')
      .limit(1)
      .maybeSingle();
    this._household.set(data ?? null);
  }

  async createHousehold(name: string): Promise<string> {
    const { data, error } = await this.supabase.client.rpc('create_household', { household_name: name });
    if (error) throw error;
    await this.loadCurrentHousehold();
    return data as string;
  }

  async createInvite(): Promise<string> {
    const householdId = this._household()?.id;
    if (!householdId) throw new Error('No household');
    const { data, error } = await this.supabase.client.rpc('create_invite', { hid: householdId });
    if (error) throw error;
    return data as string;
  }

  async acceptInvite(token: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('accept_invite', { invite_token: token });
    if (error) throw error;
    await this.loadCurrentHousehold();
  }
}
