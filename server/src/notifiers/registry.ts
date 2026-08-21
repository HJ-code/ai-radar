import type { Notifier } from './types.ts';
import { inappNotifier } from './inapp.ts';

const notifiers = new Map<string, Notifier>();

for (const n of [inappNotifier]) notifiers.set(n.channel, n);

export function registerNotifier(n: Notifier): void {
  notifiers.set(n.channel, n);
}

export function unregisterNotifier(channel: string): void {
  notifiers.delete(channel);
}

export function getNotifiers(): Notifier[] {
  return [...notifiers.values()];
}