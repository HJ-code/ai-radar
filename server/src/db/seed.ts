import { db, nowIso } from './conn.ts';

const defaultSources = [
  { sourceKey: 'hackernews', displayName: 'Hacker News', intervalMinutes: 15, extraJson: '{}' },
  { sourceKey: 'reddit', displayName: 'Reddit', intervalMinutes: 15, extraJson: '{}' },
  { sourceKey: 'github', displayName: 'GitHub 趋势', intervalMinutes: 60, extraJson: '{"limit":10,"throttleMs":6500}' },
  { sourceKey: 'arxiv', displayName: 'arXiv AI 论文', intervalMinutes: 60, extraJson: '{}' },
  { sourceKey: 'rss', displayName: '中文 AI 资讯 RSS', intervalMinutes: 30, extraJson: '{"feeds":["https://www.qbitai.com/feed","https://www.jiqizhixin.com/rss"]}' },
  { sourceKey: 'googlenews', displayName: 'Google News', intervalMinutes: 30, extraJson: '{}' },
  { sourceKey: 'huggingface', displayName: 'Hugging Face 模型热榜', intervalMinutes: 60, extraJson: '{}' },
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