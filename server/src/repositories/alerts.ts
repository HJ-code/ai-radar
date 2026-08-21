import { db } from '../db/conn.ts';
import type { AlertLogRow } from './types.ts';

export function mapAlert(r: Record<string, unknown>): AlertLogRow {
  return {
    id: r.id as number,
    keyword: r.keyword as string,
    channel: (r.channel as string) ?? 'inapp',
    title: (r.title as string | null) ?? null,
    url: (r.url as string | null) ?? null,
    status: (r.status as string) ?? 'ok',
    triggeredAt: r.triggered_at as string,
  };
}

export function addAlert(input: { keyword: string; channel?: string; title?: string | null; url?: string | null; status?: string }): AlertLogRow {
  const info = db
    .prepare('INSERT INTO alert_logs (keyword, channel, title, url, status, triggered_at) VALUES (:k, :c, :t, :u, :s, :ta)')
    .run({
      k: input.keyword,
      c: input.channel ?? 'inapp',
      t: input.title ?? null,
      u: input.url ?? null,
      s: input.status ?? 'ok',
      ta: new Date().toISOString(),
    });
  const created = db.prepare('SELECT * FROM alert_logs WHERE id = ?').get(Number(info.lastInsertRowid)) as Record<string, unknown>;
  return mapAlert(created);
}

export function listAlerts(filter: { limit?: number } = {}): AlertLogRow[] {
  const limit = Math.min(200, filter.limit ?? 50);
  const rows = db.prepare('SELECT * FROM alert_logs ORDER BY triggered_at DESC LIMIT :lim').all({ lim: limit });
  return rows.map((r) => mapAlert(r as Record<string, unknown>));
}

export function countAlerts(): number {
  return (db.prepare('SELECT count(*) AS c FROM alert_logs').get() as { c: number }).c;
}