import { inject, Injectable, effect, resource } from '@angular/core';
import { HouseholdService } from '../household/household.service';
import { SessionService } from '../auth/session.service';
import { RealtimeService } from '../realtime/realtime.service';
import { SupabaseService } from '../supabase.service';
import { StockItem, StockMovement, StockMovementReason } from './stock.models';

@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly supabase = inject(SupabaseService);
  private readonly session = inject(SessionService);
  private readonly household = inject(HouseholdService);
  private readonly realtimeService = inject(RealtimeService);

  readonly items = resource({
    params: () => ({ householdId: this.household.household()?.id ?? null }),
    loader: async ({ params }) => {
      if (!params.householdId) return [] as StockItem[];
      const { data, error } = await this.supabase.client
        .from('stock_items')
        .select('*')
        .eq('household_id', params.householdId)
        .order('label');
      if (error) throw error;
      return (data ?? []) as StockItem[];
    },
  });

  // Realtime — abonnement sans filtre (RLS filtre côté DB)
  // stock_movements n'a pas de household_id donc filtre impossible côté client
  constructor() {
    effect((onCleanup) => {
      const householdId = this.household.household()?.id;
      if (!householdId) return;

      const subscription = this.realtimeService.subscribe(
        `stock-movements-${householdId}`,
        'stock_movements',
        undefined,
        () => this.items.reload(),
      );

      onCleanup(() => subscription.unsubscribe());
    });
  }

  async addMovement(itemId: string, delta: number, reason: StockMovementReason): Promise<StockMovement> {
    const userId = this.session.user()?.id;
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await this.supabase.client
      .from('stock_movements')
      .insert({ stock_item_id: itemId, delta, reason, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    this.items.reload();
    return data as StockMovement;
  }

  async deleteMovement(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('stock_movements')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this.items.reload();
  }

  async createItem(
    label: string,
    alertThreshold: number,
    autoDecrement: boolean,
    initialQuantity = 0,
  ): Promise<StockItem> {
    const userId = this.session.user()?.id;
    const householdId = this.household.household()?.id;
    if (!userId || !householdId) throw new Error('Not authenticated');
    const { data, error } = await this.supabase.client
      .from('stock_items')
      .insert({ label, alert_threshold: alertThreshold, auto_decrement_on_diaper: autoDecrement, household_id: householdId })
      .select()
      .single();
    if (error) throw error;
    if (initialQuantity > 0) {
      await this.addMovement((data as StockItem).id, initialQuantity, 'restock');
    } else {
      this.items.reload();
    }
    return data as StockItem;
  }

  async updateItem(id: string, patch: Partial<Pick<StockItem, 'label' | 'alert_threshold' | 'auto_decrement_on_diaper'>>): Promise<void> {
    const { error } = await this.supabase.client
      .from('stock_items')
      .update(patch)
      .eq('id', id);
    if (error) throw error;
    this.items.reload();
  }
}
