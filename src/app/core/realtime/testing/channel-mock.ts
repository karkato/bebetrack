import { vi } from 'vitest';

export function makeChannelMock() {
  let postgresCallback: ((payload: unknown) => void) | null = null;
  let statusCallback: ((status: string) => void) | null = null;

  const channel = {
    on: vi.fn().mockImplementation((_event: string, _options: unknown, cb: (payload: unknown) => void) => {
      postgresCallback = cb;
      return channel;
    }),
    subscribe: vi.fn().mockImplementation((cb: (status: string) => void) => {
      statusCallback = cb;
      return channel;
    }),
  };

  return {
    channel,
    triggerEvent: (payload: unknown) => postgresCallback?.(payload),
    triggerStatus: (status: string) => statusCallback?.(status),
  };
}
