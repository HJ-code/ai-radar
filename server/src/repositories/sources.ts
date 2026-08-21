import { db } from '../db/conn.ts';
import type { SourceRow } from './types.ts';

export function mapSource(r: Record<string, unknown>): SourceRow {
  return {
    id: r.id as number,
    sourceKey: r.source_key as string,
    displayName: r.display_name as string,
    enabled: (r.enabled as number) === 1,
    apiKey: (r.api_key as string | null) ?? null,
    intervalMinutes: r.interval_minutes as number,
    lastRunAt: (r.last_run_at as string | null) ?? null,
    extraJson: (r.extra_json as string) ?? '{}',
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function listSources(): SourceRow[] {
  return (db.prepare('SELECT * FROM sources ORDER BY id').all() as Record<string, unknown>[]).map(mapSource);
}

export function listEnabledSources(): SourceRow[] {
  return db
    .prepare('SELECT * FROM sources WHERE enabled = 1 ORDER BY id')
    .all()
    .map((r) => mapSource(r as Record<string, unknown>));
}

export function getSource(id: number): SourceRow | null {
  const r = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return r ? mapSource(r) : null;
}

export function toggleSource(id: number): SourceRow | null {
  db.prepare('UPDATE sources SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
  return getSource(id);
}

export function updateSource(
  id: number,
  patch: Partial<Pick<SourceRow, 'enabled' | 'apiKey' | 'intervalMinutes' | 'extraJson' | 'displayName'>>,
): SourceRow | null {
  const cur = getSource(id);
  if (!cur) return null;
  const displayName = patch.displayName ?? cur.displayName;
  const enabled = patch.enabled ?? cur.enabled;
  const apiKey = patch.apiKey !== undefined ? patch.apiKey : cur.apiKey;
  const intervalMinutes = patch.intervalMinutes !== undefined ? clamp(Math.round(patch.intervalMinutes), 1, 24 * 60) : cur.intervalMinutes;
  const extraJson = patch.extraJson !== undefined ? patch.extraJson : cur.extraJson;
  db.prepare(
    'UPDATE sources SET display_name = :d, enabled = :e, api_key = :a, interval_minutes = :i, extra_json = :x WHERE id = :id',
  ).run({ d: displayName, e: enabled ? 1 : 0, a: apiKey, i: intervalMinutes, x: extraJson, id });
  return getSource(id);
}

export function updateLastRun(id: number, ts: string): void {
  db.prepare('UPDATE sources SET last_run_at = ? WHERE id = ?').run(ts, id);
}

export function insertSource(row: { sourceKey: string; displayName: string; intervalMinutes: number; extraJson: string }): SourceRow {
  db.prepare(
    'INSERT INTO sources (source_key, display_name, enabled, interval_minutes, last_run_at, extra_json) VALUES (:sk, :dn, 1, :iv, NULL, :ej)',
  ).run({ sk: row.sourceKey, dn: row.displayName, iv: row.intervalMinutes, ej: row.extraJson });
  const created = db.prepare('SELECT * FROM sources WHERE source_key = ?').get(row.sourceKey) as Record<string, unknown>;
  return mapSource(created);
}