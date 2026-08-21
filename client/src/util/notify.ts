import type { NotificationPermission } from '../types.ts';

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotificationPermission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (getNotificationPermission() === 'unsupported') return 'unsupported';
  const p = await Notification.requestPermission();
  return p as NotificationPermission;
}

/** 已授权时弹浏览器通知；点击回到原文 */
export function showBrowserNotification(title: string, opts: { body?: string | null; url?: string | null }): void {
  if (getNotificationPermission() !== 'granted') return;
  try {
    const n = new Notification(title, {
      body: opts.body?.slice(0, 160) ?? undefined,
      tag: opts.url ?? title,
      data: { url: opts.url ?? null },
    });
    if (opts.url) {
      n.onclick = () => {
        window.focus();
        window.open(opts.url ?? '', '_blank');
        n.close();
      };
    }
  } catch { /* 未授权环境抛错则静默 */ }
}