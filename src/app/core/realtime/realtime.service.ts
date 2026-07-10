import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
  REALTIME_LISTEN_TYPES,
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
} from '@supabase/supabase-js';
import { SupabaseService } from '../supabase.service';
import { RealtimeStatus, RealtimeSubscription } from './realtime.models';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly supabase = inject(SupabaseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly channels = new Map<string, RealtimeChannel>();

  // Per-channel status tracking (M2)
  private readonly channelStatuses = new Map<string, RealtimeStatus>();
  private readonly _statusSignal = signal<Map<string, RealtimeStatus>>(new Map());

  // Global computed status: CHANNEL_ERROR if any channel errors, SUBSCRIBED if all subscribed, else CONNECTING
  readonly status = computed<RealtimeStatus>(() => {
    const statuses = Array.from(this._statusSignal().values());
    if (statuses.some(s => s === 'CHANNEL_ERROR' || s === 'TIMED_OUT')) return 'CHANNEL_ERROR';
    if (statuses.length > 0 && statuses.every(s => s === 'SUBSCRIBED')) return 'SUBSCRIBED';
    return 'CONNECTING';
  });

  // Per-channel retry timer handles (M1)
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const channel of this.channels.values()) {
        this.supabase.client.removeChannel(channel);
      }
      this.channels.clear();
      // Clear all pending retry timers on destroy (M1)
      for (const timer of this.retryTimers.values()) {
        clearTimeout(timer);
      }
      this.retryTimers.clear();
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
    callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  ): RealtimeSubscription {
    // Remove existing channel with same name if any
    this.unsubscribeChannel(channelName);

    const channel = this.supabase.client
      .channel(channelName)
      .on(
        REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
        {
          event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL,
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        callback,
      )
      .subscribe((status: string) => {
        const s = status as RealtimeStatus;
        // Update per-channel status (M2)
        this.channelStatuses.set(channelName, s);
        this._statusSignal.set(new Map(this.channelStatuses));

        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          console.warn(`[Realtime] Channel ${channelName} status: ${status} — will retry`);
          // Clear any existing retry timer for this channel (M1)
          const existing = this.retryTimers.get(channelName);
          if (existing) clearTimeout(existing);

          const timer = setTimeout(() => {
            this.retryTimers.delete(channelName);
            if (this.channels.has(channelName)) {
              const currentChannelStatus = this.channelStatuses.get(channelName);
              if (currentChannelStatus === 'CHANNEL_ERROR' || currentChannelStatus === 'TIMED_OUT') {
                this.resubscribe(channelName, table, filter, callback);
              }
            }
          }, 10_000);
          this.retryTimers.set(channelName, timer);
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
    // Cancel any pending retry timer for this channel (M1)
    const timer = this.retryTimers.get(channelName);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(channelName);
    }
    // Remove per-channel status (M2)
    this.channelStatuses.delete(channelName);
    this._statusSignal.set(new Map(this.channelStatuses));
  }

  private resubscribe(
    channelName: string,
    table: string,
    filter: string | undefined,
    callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  ): void {
    console.info(`[Realtime] Re-subscribing channel ${channelName}`);
    this.subscribe(channelName, table, filter, callback);
  }
}
