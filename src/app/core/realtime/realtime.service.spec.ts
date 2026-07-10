import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { RealtimeService } from './realtime.service';
import { SupabaseService } from '../supabase.service';
import { makeChannelMock } from './testing/channel-mock';

function makeSupabaseMock() {
  const channelMockFactory = vi.fn();
  const removeChannelFn = vi.fn().mockResolvedValue('ok');
  return {
    mock: {
      client: {
        channel: channelMockFactory,
        removeChannel: removeChannelFn,
      },
    } as unknown as SupabaseService,
    channelMockFactory,
    removeChannelFn,
  };
}

describe('RealtimeService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('subscribe() creates a channel with the correct table and filter', () => {
    const { mock, channelMockFactory } = makeSupabaseMock();
    const { channel } = makeChannelMock();
    channelMockFactory.mockReturnValue(channel);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
      ],
    });

    const svc = TestBed.inject(RealtimeService);
    svc.subscribe('feedings-baby-b1', 'feedings', 'baby_id=eq.b1', vi.fn());

    expect(channelMockFactory).toHaveBeenCalledWith('feedings-baby-b1');
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'feedings', filter: 'baby_id=eq.b1' }),
      expect.any(Function),
    );
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it('subscribe() without filter does not include filter key', () => {
    const { mock, channelMockFactory } = makeSupabaseMock();
    const { channel } = makeChannelMock();
    channelMockFactory.mockReturnValue(channel);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
      ],
    });

    const svc = TestBed.inject(RealtimeService);
    svc.subscribe('test-channel', 'feedings', undefined, vi.fn());

    const onOptions = channel.on.mock.calls[0][1] as Record<string, unknown>;
    expect(onOptions['filter']).toBeUndefined();
  });

  it('callback is called when triggerEvent fires', () => {
    const { mock, channelMockFactory } = makeSupabaseMock();
    const { channel, triggerEvent } = makeChannelMock();
    channelMockFactory.mockReturnValue(channel);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
      ],
    });

    const svc = TestBed.inject(RealtimeService);
    const callback = vi.fn();
    svc.subscribe('feedings-baby-b1', 'feedings', 'baby_id=eq.b1', callback);

    const payload = { eventType: 'INSERT', new: { id: 'f-1' } };
    triggerEvent(payload);

    expect(callback).toHaveBeenCalledWith(payload);
  });

  // M2: status is now a computed() derived from per-channel statuses
  it('status computed updates when triggerStatus fires (single channel)', () => {
    const { mock, channelMockFactory } = makeSupabaseMock();
    const { channel, triggerStatus } = makeChannelMock();
    channelMockFactory.mockReturnValue(channel);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
      ],
    });

    const svc = TestBed.inject(RealtimeService);
    svc.subscribe('feedings-baby-b1', 'feedings', 'baby_id=eq.b1', vi.fn());

    // No channels have reported status yet — computed returns 'CONNECTING'
    expect(svc.status()).toBe('CONNECTING');

    triggerStatus('SUBSCRIBED');
    expect(svc.status()).toBe('SUBSCRIBED');

    triggerStatus('CHANNEL_ERROR');
    expect(svc.status()).toBe('CHANNEL_ERROR');
  });

  // M2: global status reflects worst state across multiple channels
  it('status computed is CHANNEL_ERROR when any channel errors, SUBSCRIBED when all subscribed', () => {
    const { mock, channelMockFactory } = makeSupabaseMock();
    const { channel: ch1, triggerStatus: triggerStatus1 } = makeChannelMock();
    const { channel: ch2, triggerStatus: triggerStatus2 } = makeChannelMock();
    let callCount = 0;
    channelMockFactory.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? ch1 : ch2;
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
      ],
    });

    const svc = TestBed.inject(RealtimeService);
    svc.subscribe('chan-feedings', 'feedings', undefined, vi.fn());
    svc.subscribe('chan-diapers', 'diapers', undefined, vi.fn());

    triggerStatus1('SUBSCRIBED');
    triggerStatus2('SUBSCRIBED');
    expect(svc.status()).toBe('SUBSCRIBED');

    // One channel errors — global status must reflect it
    triggerStatus2('CHANNEL_ERROR');
    expect(svc.status()).toBe('CHANNEL_ERROR');

    // Both recover
    triggerStatus2('SUBSCRIBED');
    expect(svc.status()).toBe('SUBSCRIBED');
  });

  it('unsubscribe() calls removeChannel', () => {
    const { mock, channelMockFactory, removeChannelFn } = makeSupabaseMock();
    const { channel } = makeChannelMock();
    channelMockFactory.mockReturnValue(channel);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
      ],
    });

    const svc = TestBed.inject(RealtimeService);
    const sub = svc.subscribe('feedings-baby-b1', 'feedings', 'baby_id=eq.b1', vi.fn());
    sub.unsubscribe();

    expect(removeChannelFn).toHaveBeenCalledWith(channel);
  });

  it('destroyRef cleanup removes all channels', () => {
    const { mock, channelMockFactory, removeChannelFn } = makeSupabaseMock();

    const { channel: ch1 } = makeChannelMock();
    const { channel: ch2 } = makeChannelMock();
    let callCount = 0;
    channelMockFactory.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? ch1 : ch2;
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
      ],
    });

    const svc = TestBed.inject(RealtimeService);
    svc.subscribe('chan-1', 'feedings', undefined, vi.fn());
    svc.subscribe('chan-2', 'diapers', undefined, vi.fn());

    TestBed.resetTestingModule(); // triggers destroyRef

    expect(removeChannelFn).toHaveBeenCalledWith(ch1);
    expect(removeChannelFn).toHaveBeenCalledWith(ch2);
  });

  it('subscribing with the same channel name replaces the previous channel', () => {
    const { mock, channelMockFactory, removeChannelFn } = makeSupabaseMock();

    const { channel: ch1 } = makeChannelMock();
    const { channel: ch2 } = makeChannelMock();
    let callCount = 0;
    channelMockFactory.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? ch1 : ch2;
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
      ],
    });

    const svc = TestBed.inject(RealtimeService);
    svc.subscribe('feedings-baby-b1', 'feedings', 'baby_id=eq.b1', vi.fn());
    svc.subscribe('feedings-baby-b1', 'feedings', 'baby_id=eq.b1', vi.fn());

    expect(removeChannelFn).toHaveBeenCalledWith(ch1);
    expect(ch2.subscribe).toHaveBeenCalled();
  });

  // M1: retry timer is cleared when unsubscribe is called during the 10s window
  it('retry timer is cancelled when unsubscribeChannel is called before timeout fires', () => {
    vi.useFakeTimers();
    const { mock, channelMockFactory } = makeSupabaseMock();
    const { channel, triggerStatus } = makeChannelMock();
    channelMockFactory.mockReturnValue(channel);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SupabaseService, useValue: mock },
      ],
    });

    const svc = TestBed.inject(RealtimeService);
    const resubscribeSpy = vi.spyOn(svc as unknown as { resubscribe: () => void }, 'resubscribe');
    const sub = svc.subscribe('feedings-baby-b1', 'feedings', 'baby_id=eq.b1', vi.fn());

    triggerStatus('CHANNEL_ERROR');
    // Unsubscribe before the 10s retry fires
    sub.unsubscribe();
    // Advance past the 10s retry window
    vi.advanceTimersByTime(15_000);

    // resubscribe must NOT have been called
    expect(resubscribeSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
