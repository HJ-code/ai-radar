import { db, nowIso } from './conn.ts';

/** 国内官方媒体 Feed（实测可达；新库默认全量，老库由 ensureRuntimeSources 幂等补缺） */
const DOMESTIC_FEEDS = [
  'https://www.qbitai.com/feed',
  'https://www.jiqizhixin.com/rss',
  'https://www.ithome.com/rss/',
  'https://www.geekpark.net/rss',
  'https://www.leiphone.com/feed',
  'https://www.infoq.cn/feed',
  'https://www.oschina.net/news/rss',
];

const defaultSources = [
  { sourceKey: 'hackernews', displayName: 'Hacker News', intervalMinutes: 15, extraJson: '{}' },
  { sourceKey: 'reddit', displayName: 'Reddit', intervalMinutes: 15, extraJson: '{}' },
  { sourceKey: 'github', displayName: 'GitHub 高星新仓库', intervalMinutes: 60, extraJson: '{"limit":10,"throttleMs":6500,"minStars":500}' },
  {
    sourceKey: 'rss',
    displayName: '中文 AI 资讯 RSS',
    intervalMinutes: 30,
    extraJson: JSON.stringify({ feeds: DOMESTIC_FEEDS }),
  },
  { sourceKey: 'googlenews', displayName: 'Google News', intervalMinutes: 30, extraJson: '{}' },
  { sourceKey: 'huggingface', displayName: 'Hugging Face 模型热榜', intervalMinutes: 60, extraJson: '{}' },
  { sourceKey: 'bilibili', displayName: 'B站 科技/AI 视频', intervalMinutes: 60, extraJson: '{"rid":188,"limit":20}' },
];

const defaultRanges = [
  {
    name: 'AI 业界热点',
    description: '人工智能领域的最新动态、发布与讨论',
    queriesCsv: 'OpenAI,Anthropic,Google DeepMind,GPT,Claude,Gemini,Llama,Mistral,AI agent',
  },
  {
    name: 'AI 编程工具',
    description: 'AI 编程与开发者工具热点',
    queriesCsv: 'Cursor,Copilot,AI coding,code assistant',
  },
];

const defaultKeywords = [
  { keyword: 'GPT', note: 'OpenAI 大模型' },
  { keyword: 'Claude', note: 'Anthropic 大模型' },
  { keyword: 'Gemini', note: 'Google 大模型' },
  { keyword: 'OpenAI', note: 'OpenAI 动态' },
  { keyword: 'Anthropic', note: 'Anthropic 动态' },
  { keyword: 'Llama', note: 'Meta 开源模型' },
];

export function seed(): void {
  const count = (t: string) => (db.prepare(`SELECT count(*) AS c FROM ${t}`).get() as { c: number }).c;

  if (count('sources') === 0) {
    const ins = db.prepare(
      'INSERT INTO sources (source_key, display_name, enabled, interval_minutes, last_run_at, extra_json) VALUES (:sk, :dn, 1, :iv, NULL, :ej)',
    );
    for (const s of defaultSources) {
      ins.run({ sk: s.sourceKey, dn: s.displayName, iv: s.intervalMinutes, ej: s.extraJson });
    }
  }
  ensureRuntimeSources();

  if (count('ranges') === 0) {
    const ins = db.prepare(
      'INSERT INTO ranges (name, description, queries_csv, enabled, created_at) VALUES (:n, :d, :q, 1, :c)',
    );
    for (const r of defaultRanges) {
      ins.run({ n: r.name, d: r.description, q: r.queriesCsv, c: nowIso() });
    }
  }

  if (count('keywords') === 0) {
    const ins = db.prepare(
      'INSERT INTO keywords (keyword, note, enabled, created_at) VALUES (:k, :n, 1, :c)',
    );
    for (const k of defaultKeywords) {
      ins.run({ k: k.keyword, n: k.note, c: nowIso() });
    }
  }
}

/**
 * 老库幂等补缺：只加官方源与 B站，不覆盖用户已自定义的 feed 与启用状态。
 * - rss 源：把 DOMESTIC_FEEDS 里缺失的 feed 追加进去（保留用户自加的 feed）；
 * - bilibili：源不存在才插入（默认启用）。
 */
export function ensureRuntimeSources(): void {
  const rssRow = db.prepare(`SELECT id, extra_json FROM sources WHERE source_key = 'rss' ORDER BY id LIMIT 1`).get() as
    | { id: number; extra_json: string }
    | undefined;
  if (rssRow) {
    let extra: { feeds?: unknown } = {};
    try {
      const parsed = JSON.parse(rssRow.extra_json || '{}');
      if (parsed && typeof parsed === 'object') extra = parsed as { feeds?: unknown };
    } catch {
      /* 忽略损坏的 extraJson，保留原值 */
    }
    const feeds = Array.isArray(extra.feeds) ? (extra.feeds as string[]) : [];
    const merged = [...feeds];
    for (const f of DOMESTIC_FEEDS) {
      if (!merged.includes(f)) merged.push(f);
    }
    const next = JSON.stringify({ ...extra, feeds: merged });
    if (next !== rssRow.extra_json) {
      db.prepare('UPDATE sources SET extra_json = ? WHERE id = ?').run(next, rssRow.id);
      console.log('[seed] rss 源已补缺国内官方 feeds');
    }
  }

  const hasBili = db.prepare(`SELECT id FROM sources WHERE source_key = 'bilibili' LIMIT 1`).get();
  if (!hasBili) {
    db.prepare(
      "INSERT INTO sources (source_key, display_name, enabled, interval_minutes, last_run_at, extra_json) VALUES ('bilibili', 'B站 科技/AI 视频', 1, 60, NULL, '{\"rid\":188,\"limit\":20}')",
    ).run();
    console.log('[seed] 已新增 B站 数据源');
  }
}