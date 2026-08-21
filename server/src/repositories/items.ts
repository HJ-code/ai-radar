import { db, nowIso } from '../db/conn.ts';
import type { ItemRow } from './types.ts';

export interface NewItem {
  sourceKey: string;
  externalId: string;
  title: string | null;
  text: string | null;
  url: string | null;
  author: string | null;
  authorUrl: string | null;
  publishedAt: string | null;
  query: string;
  engagementJson: string;
  rawJson: string;
}

export function mapItem(r: Record<string, unknown>): ItemRow {
  return {
    id: r.id as number,
    sourceKey: r.source_key as string,
    externalId: r.external_id as string,
    title: (r.title as string | null) ?? null,
    text: (r.text as string | null) ?? null,
    url: (r.url as string | null) ?? null,
    author: (r.author as string | null) ?? null,
    authorUrl: (r.author_url as string | null) ?? null,
    publishedAt: (r.published_at as string | null) ?? null,
    collectedAt: r.collected_at as string,
    query: (r.query as string) ?? '',
    engagementJson: (r.engagement_json as string) ?? '{}',
    rawJson: (r.raw_json as string) ?? '{}',
    aiStatus: (r.ai_status as string) ?? 'unscored',
    aiRelevance: (r.ai_relevance as number) ?? 0,
    summaryZh: (r.summary_zh as string | null) ?? null,
    notified: (r.notified as number) === 1,
    aiAt: (r.ai_at as string | null) ?? null,
  };
}

/** 按 (source_key, external_id) 去重插入，返回是否为新条目 */
export function insertItem(item: NewItem): { inserted: boolean; id: number } {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO items
      (source_key, external_id, title, text, url, author, author_url, published_at, collected_at, query, engagement_json, raw_json)
     VALUES (:sk, :eid, :t, :tx, :u, :a, :au, :pa, :ca, :q, :ej, :rj)`,
  );
  const info = stmt.run({
    sk: item.sourceKey,
    eid: item.externalId,
    t: item.title,
    tx: item.text,
    u: item.url,
    a: item.author,
    au: item.authorUrl,
    pa: item.publishedAt,
    ca: new Date().toISOString(),
    q: item.query,
    ej: item.engagementJson,
    rj: item.rawJson,
  });
  return { inserted: info.changes > 0, id: Number(info.lastInsertRowid) };
}

export function listItems(filter: { limit?: number; sourceKey?: string; status?: string; q?: string } = {}): ItemRow[] {
  const conds: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.sourceKey) { conds.push('source_key = :sk'); params.sk = filter.sourceKey; }
  if (filter.status) { conds.push('ai_status = :st'); params.st = filter.status; }
  if (filter.q) { conds.push('(title LIKE :q OR text LIKE :q)'); params.q = `%${filter.q}%`; }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const limit = Math.min(200, filter.limit ?? 50);
  const rows = db
    .prepare(`SELECT * FROM items ${where} ORDER BY COALESCE(published_at, collected_at) DESC LIMIT :lim`)
    .all({ ...params, lim: limit });
  return rows.map((r) => mapItem(r as Record<string, unknown>));
}

export function countItems(): number {
  return (db.prepare('SELECT count(*) AS c FROM items').get() as { c: number }).c;
}

export function latestCollectedAt(): string | null {
  return (db.prepare('SELECT max(collected_at) AS c FROM items').get() as { c: string | null }).c ?? null;
}

export function getItem(id: number): ItemRow | null {
  const r = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return r ? mapItem(r) : null;
}

/** 待 AI/规则鉴定的未处理条目，最新优先 */
export function listUnscored(limit: number): ItemRow[] {
  const rows = db
    .prepare(`SELECT * FROM items WHERE ai_status = 'unscored' ORDER BY COALESCE(published_at, collected_at) DESC LIMIT ?`)
    .all(limit);
  return rows.map((r) => mapItem(r as Record<string, unknown>));
}

/** 写入 AI 三道关结果 */
export function updateItemAi(id: number, input: { aiStatus: string; aiRelevance: number; summaryZh: string | null }): void {
  db.prepare('UPDATE items SET ai_status = :st, ai_relevance = :re, summary_zh = :sz, ai_at = :at WHERE id = :id').run({
    st: input.aiStatus,
    re: input.aiRelevance,
    sz: input.summaryZh,
    at: nowIso(),
    id,
  });
}

/** 标记该条目已发过通知（同条目不重复告警） */
export function markItemNotified(id: number): void {
  db.prepare('UPDATE items SET notified = 1 WHERE id = ?').run(id);
}