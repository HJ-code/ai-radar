import { db } from '../db/conn.ts';
import type { RangeRow } from './types.ts';

export function mapRange(r: Record<string, unknown>): RangeRow {
  return {
    id: r.id as number,
    name: r.name as string,
    description: (r.description as string) ?? '',
    queriesCsv: (r.queries_csv as string) ?? '',
    enabled: (r.enabled as number) === 1,
    createdAt: r.created_at as string,
  };
}

export function listRanges(): RangeRow[] {
  return (db.prepare('SELECT * FROM ranges ORDER BY id DESC').all() as Record<string, unknown>[]).map(mapRange);
}

export function listEnabledRanges(): RangeRow[] {
  return db.prepare('SELECT * FROM ranges WHERE enabled = 1').all().map((r) => mapRange(r as Record<string, unknown>));
}

export function getRange(id: number): RangeRow | null {
  const r = db.prepare('SELECT * FROM ranges WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return r ? mapRange(r) : null;
}

export function createRange(input: { name: string; description?: string; queriesCsv?: string; enabled?: boolean }): RangeRow {
  const createdAt = new Date().toISOString();
  const info = db
    .prepare('INSERT INTO ranges (name, description, queries_csv, enabled, created_at) VALUES (:n, :d, :q, :e, :c)')
    .run({ n: input.name, d: input.description ?? '', q: input.queriesCsv ?? '', e: input.enabled ?? true ? 1 : 0, c: createdAt });
  const created = db.prepare('SELECT * FROM ranges WHERE id = ?').get(Number(info.lastInsertRowid)) as Record<string, unknown>;
  return mapRange(created);
}

export function updateRange(id: number, input: Partial<Pick<RangeRow, 'name' | 'description' | 'queriesCsv' | 'enabled'>>): RangeRow | null {
  const cur = getRange(id);
  if (!cur) return null;
  const name = input.name ?? cur.name;
  const description = input.description ?? cur.description;
  const queriesCsv = input.queriesCsv ?? cur.queriesCsv;
  const enabled = input.enabled ?? cur.enabled;
  db.prepare('UPDATE ranges SET name = :n, description = :d, queries_csv = :q, enabled = :e WHERE id = :id').run({
    n: name, d: description, q: queriesCsv, e: enabled ? 1 : 0, id,
  });
  return getRange(id);
}

export function deleteRange(id: number): boolean {
  const info = db.prepare('DELETE FROM ranges WHERE id = ?').run(id);
  return info.changes > 0;
}