import { nowIso } from '../db/conn.ts';
import type { SourceRow } from '../repositories/types.ts';
import { listEnabledSources, updateLastRun } from '../repositories/sources.ts';
import { listEnabledRanges } from '../repositories/ranges.ts';
import { listEnabledKeywords } from '../repositories/keywords.ts';
import { insertItem, type NewItem } from '../repositories/items.ts';
import { getCollector } from '../collectors/registry.ts';
import { getExtra } from '../util/helpers.ts';
import type { Collector, ItemDto } from '../collectors/types.ts';
import { processPendingItems } from './aiPipeline.ts';

/** 每轮最多搜索的词条数，避免请求过多 */
const MAX_QUERIES = 30;

export interface RunResult {
  added: number;
  filtered: number;
  scanned: number;
  aiProcessed: number;
  errors: string[];
  ranAt: string;
}

function buildQueries(): string[] {
  const qs = new Set<string>();
  for (const r of listEnabledRanges()) {
    for (const term of r.queriesCsv.split(',').map((t) => t.trim()).filter(Boolean)) qs.add(term);
  }
  for (const k of listEnabledKeywords()) qs.add(k.keyword.trim());
  return [...qs].filter(Boolean).slice(0, MAX_QUERIES);
}

/** 全部启用关键词/范围词（预过滤用，不受 MAX_QUERIES 上限影响） */
function buildScopeTerms(): string[] {
  const terms = new Set<string>();
  for (const r of listEnabledRanges()) {
    for (const term of r.queriesCsv.split(',').map((t) => t.trim()).filter(Boolean)) terms.add(term);
  }
  for (const k of listEnabledKeywords()) terms.add(k.keyword.trim());
  return [...terms].filter(Boolean);
}

/** 采集层预过滤：标题/正文/URL 命中任一启用关键词/范围词才进库，从源头卡掉无关噪音 */
function hitsScope(it: ItemDto, terms: string[]): boolean {
  const hay = `${it.title ?? ''}\n${it.text ?? ''}\n${it.url ?? ''}`.toLowerCase();
  return terms.some((t) => t && hay.includes(t.toLowerCase()));
}

function isDue(src: SourceRow): boolean {
  if (!src.lastRunAt) return true;
  const elapsed = Date.now() - Date.parse(src.lastRunAt);
  return !Number.isNaN(elapsed) && elapsed >= src.intervalMinutes * 60_000;
}

function truncate(s: string | null | undefined, n: number): string | null {
  if (!s) return null;
  return s.length > n ? s.slice(0, n) : s;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNewItem(src: SourceRow, query: string, it: ItemDto): NewItem {
  return {
    sourceKey: src.sourceKey,
    externalId: it.externalId,
    title: truncate(it.title, 500),
    text: truncate(it.text, 2000),
    url: truncate(it.url, 1000),
    author: truncate(it.author, 200),
    authorUrl: truncate(it.authorUrl, 500),
    publishedAt: it.publishedAt ?? null,
    query,
    engagementJson: JSON.stringify(it.engagement ?? null),
    rawJson: JSON.stringify(it.raw ?? null),
  };
}

/** 采集一轮：逐源顺序、逐查询顺序，单源失败不中断整体 */
export async function runOnce(opts: { force?: boolean } = {}): Promise<RunResult> {
  const force = opts.force ?? false;
  const sources = listEnabledSources();
  const queries = buildQueries();
  const scopeTerms = buildScopeTerms();
  const result: RunResult = { added: 0, filtered: 0, scanned: 0, aiProcessed: 0, errors: [], ranAt: nowIso() };

  for (const src of sources) {
    const collector = getCollector(src.sourceKey) as Collector | undefined;
    if (!collector) {
      result.errors.push(`source "${src.sourceKey}" 无对应采集器实现`);
      continue;
    }
    if (!force && !isDue(src)) continue;

    result.scanned += 1;
    const throttleMs = Number(getExtra(src).throttleMs ?? 0);
    try {
      let sourceAdded = 0;
      for (const q of queries) {
        // 整库型源与具体关键词无关，用空 query 入库，避免给所有条目误标范围
        const queryLabel = collector.wholeList ? '' : q;
        const items = await collector.search(q, src);
        for (const it of items) {
          if (!hitsScope(it, scopeTerms)) {
            result.filtered += 1;
            continue;
          }
          const { inserted } = insertItem(toNewItem(src, queryLabel, it));
          if (inserted) sourceAdded += 1;
        }
        if (throttleMs > 0) await sleep(throttleMs);
        // 整库型源（RSS/B站等）一次 search 已拉全量，无需按每个关键词重复请求
        if (collector.wholeList) break;
      }
      updateLastRun(src.id, nowIso());
      result.added += sourceAdded;
    } catch (err) {
      result.errors.push(`${src.sourceKey}: ${(err as Error).message}`);
    }
  }

  // 采集完成后跑 AI 三道关（未配置或失败时降级为规则相关度）
  try {
    const ai = await processPendingItems();
    result.aiProcessed = ai.processed;
  } catch (err) {
    result.errors.push(`ai-pipeline: ${(err as Error).message}`);
  }

  return result;
}