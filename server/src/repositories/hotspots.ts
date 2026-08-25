import { db } from '../db/conn.ts';
import { engagementMagnitude } from '../util/helpers.ts';
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
    engagementMagnitude: (r.engagement_magnitude as number) ?? 0,
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
  engagementMagnitude: number;
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
        (item_id, title, text, url, source_key, author, hot_score, range_name, ai_status, ai_relevance, summary_zh, published_at, created_at, engagement_magnitude)
       VALUES (:ii, :t, :tx, :u, :sk, :a, :hs, :rn, :st, :re, :sz, :pa, :ca, :em)`,
    )
    .run({
      ii: h.itemId, t: h.title, tx: h.text, u: h.url, sk: h.sourceKey, a: h.author,
      hs: h.hotScore, rn: h.rangeName, st: h.aiStatus, re: h.aiRelevance, sz: h.summaryZh,
      pa: h.publishedAt, ca: new Date().toISOString(), em: h.engagementMagnitude,
    });
  return { inserted: info.changes > 0, id: Number(info.lastInsertRowid) };
}

/** 回填：为 item_id 非空但互动量未记录的存量热点，从 items.engagement_json 反算写入 */
export function backfillEngagementMagnitude(): number {
  const rows = db
    .prepare(`SELECT h.id AS hid, i.engagement_json AS ej FROM hotspots h LEFT JOIN items i ON i.id = h.item_id WHERE h.item_id IS NOT NULL AND h.engagement_magnitude = 0`)
    .all() as { hid: number; ej: string | null }[];
  const upd = db.prepare('UPDATE hotspots SET engagement_magnitude = ? WHERE id = ?');
  let n = 0;
  for (const r of rows) {
    const m = engagementMagnitude(r.ej ?? '{}');
    if (m > 0) { upd.run(m, r.hid); n += 1; }
  }
  return n;
}

export type HotspotSortKey = 'smart' | 'published' | 'collected' | 'hot' | 'engagement' | 'relevance';

interface HotspotFilter {
  limit?: number;
  sort?: HotspotSortKey;
  order?: 'asc' | 'desc';
  rangeName?: string;
  /** 逗号分隔多选：source/status */
  sources?: string[];
  statuses?: string[];
  since?: string;
  until?: string;
  type?: 'news' | 'interactive';
  relevanceMin?: number;
  relevanceMax?: number;
  scoreMin?: number;
  scoreMax?: number;
  q?: string;
  author?: string;
  /** keyset 游标：由排序键 + id 组成的数组 */
  before?: (string | number)[];
}

/** 交互型源白名单（其余视为资讯型，如 rss） */
const INTERACTIVE_SOURCES = new Set(['hackernews', 'github', 'bilibili', 'reddit', 'huggingface']);

/** 当前 SQL 时间 UTC 的 ISO 前缀（用于游标基准，避免 JS/DB 时钟差） */
const NOW_SQL = `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/** 排序定义：SQL 排序表达式、isSmart 是否计算列（决定游标比较方式）、游标所需键 */
const SORTS: Record<
  HotspotSortKey,
  { expr: string; smart?: boolean; keys: string[] }
> = {
  smart: {
    expr: `(hot_score * 1.0) / power(abs((julianday(${NOW_SQL}) - julianday(coalesce(created_at, published_at))) * 24) + 2, 1.5)`,
    smart: true,
    keys: ['smart', 'id'],
  },
  published: { expr: 'published_at', keys: ['published_at', 'id'] },
  collected: { expr: 'created_at', keys: ['created_at', 'id'] },
  hot: { expr: 'hot_score', keys: ['hot_score', 'id'] },
  engagement: { expr: 'engagement_magnitude', keys: ['engagement_magnitude', 'id'] },
  relevance: { expr: 'ai_relevance', keys: ['ai_relevance', 'id'] },
};

function buildConds(f: HotspotFilter): { conds: string[]; params: Record<string, string | number> } {
  const conds: string[] = [];
  const params: Record<string, string | number> = {};
  if (f.rangeName) { conds.push('range_name = :rn'); params.rn = f.rangeName; }
  if (f.sources?.length) {
    conds.push(`source_key IN (${f.sources.map((_, i) => `:src${i}`).join(',')})`);
    f.sources.forEach((s, i) => { params[`src${i}`] = s; });
  }
  if (f.statuses?.length) {
    conds.push(`ai_status IN (${f.statuses.map((_, i) => `:st${i}`).join(',')})`);
    f.statuses.forEach((s, i) => { params[`st${i}`] = s; });
  }
  if (f.since) { conds.push('published_at >= :since'); params.since = f.since; }
  if (f.until) { conds.push('published_at <= :until'); params.until = f.until; }
  if (f.type === 'news') {
    const notInteractive = [...INTERACTIVE_SOURCES];
    conds.push(`source_key NOT IN (${notInteractive.map((_, i) => `:ski${i}`).join(',')})`);
    notInteractive.forEach((s, i) => { params[`ski${i}`] = s; });
  }
  if (f.type === 'interactive') {
    const interactive = [...INTERACTIVE_SOURCES];
    conds.push(`source_key IN (${interactive.map((_, i) => `:ski${i}`).join(',')})`);
    interactive.forEach((s, i) => { params[`ski${i}`] = s; });
  }
  if (f.relevanceMin != null) { conds.push('ai_relevance >= :relMin'); params.relMin = f.relevanceMin; }
  if (f.relevanceMax != null) { conds.push('ai_relevance <= :relMax'); params.relMax = f.relevanceMax; }
  if (f.scoreMin != null) { conds.push('hot_score >= :scMin'); params.scMin = f.scoreMin; }
  if (f.scoreMax != null) { conds.push('hot_score <= :scMax'); params.scMax = f.scoreMax; }
  if (f.q) { conds.push('(title LIKE :q OR text LIKE :q OR url LIKE :q)'); params.q = `%${f.q}%`; }
  if (f.author) { conds.push('author LIKE :au'); params.au = `%${f.author}%`; }
  return { conds, params };
}

function encodeCursor(row: Record<string, unknown>, def: { smart?: boolean; keys: string[] }): string {
  const parts: (string | number)[] = [];
  for (const k of def.keys) {
    if (k === 'id') { parts.push(row.id as number); continue; }
    if (def.smart && k === 'smart') { parts.push(row.__smart as number); continue; }
    const v = row[k];
    if (typeof v === 'number') parts.push(v);
    else parts.push(String(v ?? ''));
  }
  return parts.join('|');
}

function buildCursorConds(
  before: (string | number)[],
  def: { smart?: boolean; keys: string[] },
  order: 'asc' | 'desc',
): { conds: string[]; params: Record<string, string | number> } {
  const conds: string[] = [];
  const params: Record<string, string | number> = {};
  const cmp = order === 'desc' ? '<' : '>';
  const keyCols = def.keys; // e.g. ['published_at','id'] or ['smart','id']
  const n = Math.min(before.length, keyCols.length);

  // 逐前缀行比较：(k1,k2) < (v1,v2)  →  k1<v1 OR (k1=v1 AND k2<v2)
  for (let i = 0; i < n; i++) {
    const prefix: string[] = [];
    for (let j = 0; j <= i; j++) {
      const key = keyCols[j];
      const valKey = `b${j}`;
      if (key === 'id') {
        prefix.push(`id = :${valKey}`);
        params[valKey] = before[j];
      } else if (def.smart && key === 'smart') {
        prefix.push(`${SORTS.smart.expr} = :${valKey}`);
        params[valKey] = before[j];
      } else {
        prefix.push(`${key} = :${valKey}`);
        params[valKey] = before[j];
      }
    }
    const lastKey = keyCols[i];
    if (lastKey === 'id') {
      prefix[i] = `id ${cmp} :b${i}`;
      params[`b${i}`] = before[i];
    } else if (def.smart && lastKey === 'smart') {
      prefix[i] = `${SORTS.smart.expr} ${cmp} :b${i}`;
      params[`b${i}`] = before[i];
    } else {
      prefix[i] = `${lastKey} ${cmp} :b${i}`;
      params[`b${i}`] = before[i];
    }
    conds.push(`(${prefix.join(' AND ')})`);
  }

  // 若游标比键短（理论上不会），保底一句 id 比较
  if (n === 0 && before.length && keyCols.length) {
    params.b0 = before[0];
    conds.push(`id ${cmp} :b0`);
  }
  return { conds, params };
}

export function listHotspots(
  filter: HotspotFilter = {},
): { items: HotspotRow[]; next: string | null; total: number } {
  const sort = filter.sort ?? 'smart';
  const order = filter.order ?? 'desc';
  const def = SORTS[sort] ?? SORTS.smart;
  const orderBy = `${def.expr} ${order === 'asc' ? 'ASC' : 'DESC'}, id ${order === 'asc' ? 'ASC' : 'DESC'}`;

  const { conds, params } = buildConds(filter);
  if (filter.before) {
    const bc = buildCursorConds(filter.before, def, order);
    // keyset 边界谓词是互斥的“前缀替代”，须用 OR 连接并加括号
    if (bc.conds.length) conds.push(`(${bc.conds.join(' OR ')})`);
    Object.assign(params, bc.params);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const limit = Math.min(200, filter.limit ?? 50);

  // 计算排序列时多取一列 __smart 用于游标；普通排序直接取对应列
  const selectTail = def.smart ? `, ${def.expr} AS __smart` : '';
  const rows = db
    .prepare(`SELECT * ${selectTail} FROM hotspots ${where} ORDER BY ${orderBy} LIMIT :lim`)
    .all({ ...params, lim: limit + 1 }) as Record<string, unknown>[];

  const hasNext = rows.length > limit;
  const page = hasNext ? rows.slice(0, limit) : rows;

  let next: string | null = null;
  if (hasNext && page.length) {
    next = encodeCursor(page[page.length - 1], def);
  }

  // total：仅按筛选（不含游标）统计
  const totalConds = buildConds(filter);
  const totalWhere = totalConds.conds.length ? `WHERE ${totalConds.conds.join(' AND ')}` : '';
  const cnt = db.prepare(`SELECT count(*) AS c FROM hotspots ${totalWhere}`).all(totalConds.params)[0] as
    | { c: number }
    | undefined;

  return {
    items: page.map((r) => mapHotspot(r)),
    next,
    total: cnt?.c ?? page.length,
  };
}

export function countHotspots(): number {
  return (db.prepare('SELECT count(*) AS c FROM hotspots').get() as { c: number }).c;
}

export function latestHotspotCreatedAt(): string | null {
  return (db.prepare('SELECT max(created_at) AS c FROM hotspots').get() as { c: string | null }).c ?? null;
}