import { db } from '../db/conn.ts';
import type { HotspotRow } from './types.ts';

export function mapHotspot(r: Record<string, unknown>): HotspotRow {
  return {
    id: r.id as number,
    itemId: (r.item_id as number | null) ?? null,
    title: r.title as string,
    text: (r.text as string | null) ?? null,
    url: r.url as string,
    sourceKey: r.source_key as string,
    author: (r.author as string | null) ?? null,
    hotScore: (r.hot_score as number) ?? 0,
    rangeName: (r.range_name as string | null) ?? null,
    aiStatus: (r.ai_status as string) ?? 'unscored',
    aiRelevance: (r.ai_relevance as number) ?? 0,
    summaryZh: (r.summary_zh as string | null) ?? null,
    publishedAt: r.published_at as string,
    createdAt: r.created_at as string,
  };
}

export interface NewHotspot {
  itemId: number | null;
  title: string;
  text: string | null;
  url: string;
  sourceKey: string;
  author: string | null;
  hotScore: number;
  rangeName: string | null;
  aiStatus: string;
  aiRelevance: number;
  summaryZh: string | null;
  publishedAt: string;
}

/** 按 url 唯一去重，已存在则不插入 */
export function insertHotspotIfAbsent(h: NewHotspot): { inserted: boolean; id: number } {
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO hotspots
        (item_id, title, text, url, source_key, author, hot_score, range_name, ai_status, ai_relevance, summary_zh, published_at, created_at)
       VALUES (:ii, :t, :tx, :u, :sk, :a, :hs, :rn, :st, :re, :sz, :pa, :ca)`,
    )
    .run({
      ii: h.itemId, t: h.title, tx: h.text, u: h.url, sk: h.sourceKey, a: h.author,
      hs: h.hotScore, rn: h.rangeName, st: h.aiStatus, re: h.aiRelevance, sz: h.summaryZh,
      pa: h.publishedAt, ca: new Date().toISOString(),
    });
  return { inserted: info.changes > 0, id: Number(info.lastInsertRowid) };
}

export function listHotspots(
  filter: {
    limit?: number;
    rangeName?: string;
    status?: string;
    /** keyset 游标：翻页取更早的一批（publishedAt|hotScore|id） */
    before?: { publishedAt: string; hotScore: number; id: number } | null;
  } = {},
): HotspotRow[] {
  const conds: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.rangeName) { conds.push('range_name = :rn'); params.rn = filter.rangeName; }
  if (filter.status) { conds.push('ai_status = :st'); params.st = filter.status; }
  if (filter.before) {
    conds.push(
      '(published_at < :bpa OR (published_at = :bpa AND (hot_score < :bhs OR (hot_score = :bhs AND id < :bid))))',
    );
    params.bpa = filter.before.publishedAt;
    params.bhs = filter.before.hotScore;
    params.bid = filter.before.id;
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const limit = Math.min(200, filter.limit ?? 50);
  const rows = db
    .prepare(`SELECT * FROM hotspots ${where} ORDER BY published_at DESC, hot_score DESC, id DESC LIMIT :lim`)
    .all({ ...params, lim: limit });
  return rows.map((r) => mapHotspot(r as Record<string, unknown>));
}

export function countHotspots(): number {
  return (db.prepare('SELECT count(*) AS c FROM hotspots').get() as { c: number }).c;
}

export function latestHotspotCreatedAt(): string | null {
  return (db.prepare('SELECT max(created_at) AS c FROM hotspots').get() as { c: string | null }).c ?? null;
}