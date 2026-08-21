import { db } from '../db/conn.ts';
import type { KeywordRow } from './types.ts';

export function mapKeyword(r: Record<string, unknown>): KeywordRow {
  return {
    id: r.id as number,
    keyword: r.keyword as string,
    note: (r.note as string) ?? '',
    enabled: (r.enabled as number) === 1,
    createdAt: r.created_at as string,
    lastTriggeredAt: (r.last_triggered_at as string | null) ?? null,
    triggerCount: (r.trigger_count as number) ?? 0,
    lastHotspotId: (r.last_hotspot_id as number | null) ?? null,
  };
}

export function listKeywords(): KeywordRow[] {
  return (db.prepare('SELECT * FROM keywords ORDER BY id DESC').all() as Record<string, unknown>[]).map(mapKeyword);
}

export function listEnabledKeywords(): KeywordRow[] {
  return db.prepare('SELECT * FROM keywords WHERE enabled = 1').all().map((r) => mapKeyword(r as Record<string, unknown>));
}

export function countKeywords(): number {
  return (db.prepare('SELECT count(*) AS c FROM keywords').get() as { c: number }).c;
}

export function getKeyword(id: number): KeywordRow | null {
  const r = db.prepare('SELECT * FROM keywords WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return r ? mapKeyword(r) : null;
}

export function createKeyword(input: { keyword: string; note?: string; enabled?: boolean }): KeywordRow {
  const createdAt = new Date().toISOString();
  const info = db
    .prepare('INSERT INTO keywords (keyword, note, enabled, created_at) VALUES (:k, :n, :e, :c)')
    .run({ k: input.keyword, n: input.note ?? '', e: input.enabled ?? true ? 1 : 0, c: createdAt });
  const created = db.prepare('SELECT * FROM keywords WHERE id = ?').get(Number(info.lastInsertRowid)) as Record<string, unknown>;
  return mapKeyword(created);
}

export function updateKeyword(id: number, input: Partial<Pick<KeywordRow, 'keyword' | 'note' | 'enabled'>>): KeywordRow | null {
  const cur = getKeyword(id);
  if (!cur) return null;
  const keyword = input.keyword ?? cur.keyword;
  const note = input.note ?? cur.note;
  const enabled = input.enabled ?? cur.enabled;
  db.prepare('UPDATE keywords SET keyword = :k, note = :n, enabled = :e WHERE id = :id').run({
    k: keyword, n: note, e: enabled ? 1 : 0, id,
  });
  return getKeyword(id);
}

export function deleteKeyword(id: number): boolean {
  const info = db.prepare('DELETE FROM keywords WHERE id = ?').run(id);
  return info.changes > 0;
}

export function markKeywordTriggered(id: number, hotspotId: number): void {
  db.prepare('UPDATE keywords SET last_triggered_at = ?, trigger_count = trigger_count + 1, last_hotspot_id = ? WHERE id = ?').run(
    new Date().toISOString(), hotspotId, id,
  );
}