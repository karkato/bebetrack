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

  it('status signal updates when triggerStatus fires', () => {
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

    expect(svc.status()).toBe('CONNECTING');

    triggerStatus('SUBSCRIBED');
    expect(svc.status()).toBe('SUBSCRIBED');

    triggerStatus('CHANNEL_ERROR');
    expect(svc.status()).toBe('CHANNEL_ERROR');
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
});
