import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { RealtimeStatus, RealtimeSubscription } from './realtime.models';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly supabase = inject(SupabaseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly channels = new Map<string, RealtimeChannel>();

  private readonly _status = signal<RealtimeStatus>('CONNECTING');
  readonly status = this._status.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const channel of this.channels.values()) {
        this.supabase.client.removeChannel(channel);
      }
      this.channels.clear();
    });
  }

  /**
   * Subscribe to postgres_changes on a table.
   * @param channelName Unique name for this subscription (e.g. 'feedings-baby-123')
   * @param table Table name to watch
   * @param filter Optional filter string e.g. 'baby_id=eq.some-uuid'
   * @param callback Called on INSERT/UPDATE/DELETE with the payload
   * @returns RealtimeSubscription with unsubscribe()
   */
  subscribe(
    channelName: string,
    table: string,
    filter: string | undefined,
    callback: (payload: unknown) => void,
  ): RealtimeSubscription {
    // Remove existing channel with same name if any
    this.unsubscribeChannel(channelName);

    const channelOptions: Record<string, unknown> = {
      event: '*',
      schema: 'public',
      table,
    };
    if (filter) {
      channelOptions['filter'] = filter;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = this.supabase.client
      .channel(channelName)
      .on('postgres_changes' as any, channelOptions, callback)
      .subscribe((status: string) => {
        this._status.set(status as RealtimeStatus);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Realtime] Channel ${channelName} status: ${status} — will retry`);
          // Supabase JS client handles reconnection automatically on most cases.
          // If not recovered within 10s, force re-subscribe.
          setTimeout(() => {
            if (this.channels.has(channelName)) {
              const currentStatus = this._status();
              if (currentStatus === 'CHANNEL_ERROR' || currentStatus === 'TIMED_OUT') {
                this.resubscribe(channelName, table, filter, callback);
              }
            }
          }, 10_000);
        }
      });

    this.channels.set(channelName, channel);

    return {
      unsubscribe: () => this.unsubscribeChannel(channelName),
    };
  }

  private unsubscribeChannel(channelName: string): void {
    const existing = this.channels.get(channelName);
    if (existing) {
      this.supabase.client.removeChannel(existing);
      this.channels.delete(channelName);
    }
  }

  private resubscribe(
    channelName: string,
    table: string,
    filter: string | undefined,
    callback: (payload: unknown) => void,
  ): void {
    console.info(`[Realtime] Re-subscribing channel ${channelName}`);
    this.subscribe(channelName, table, filter, callback);
  }
}
