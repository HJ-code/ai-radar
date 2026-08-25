import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.ts';

mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const schema = `
CREATE TABLE IF NOT EXISTS ranges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  queries_csv TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_triggered_at TEXT,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  last_hotspot_id INTEGER
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  api_key TEXT,
  interval_minutes INTEGER NOT NULL DEFAULT 15,
  last_run_at TEXT,
  extra_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT,
  text TEXT,
  url TEXT,
  author TEXT,
  author_url TEXT,
  published_at TEXT,
  collected_at TEXT NOT NULL,
  query TEXT NOT NULL DEFAULT '',
  engagement_json TEXT NOT NULL DEFAULT '{}',
  raw_json TEXT NOT NULL DEFAULT '{}',
  ai_status TEXT NOT NULL DEFAULT 'unscored',
  ai_relevance INTEGER NOT NULL DEFAULT 0,
  summary_zh TEXT,
  notified INTEGER NOT NULL DEFAULT 0,
  ai_at TEXT,
  UNIQUE(source_key, external_id)
);

CREATE TABLE IF NOT EXISTS hotspots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER,
  title TEXT NOT NULL,
  text TEXT,
  url TEXT NOT NULL UNIQUE,
  source_key TEXT NOT NULL,
  author TEXT,
  hot_score INTEGER NOT NULL DEFAULT 0,
  range_name TEXT,
  engagement_magnitude INTEGER NOT NULL DEFAULT 0,
  engagement_json TEXT NOT NULL DEFAULT '{}',
  ai_reasons TEXT,
  ai_status TEXT NOT NULL DEFAULT 'unscored',
  ai_relevance INTEGER NOT NULL DEFAULT 0,
  summary_zh TEXT,
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'inapp',
  title TEXT,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  triggered_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_items_published  ON items(published_at);
CREATE INDEX IF NOT EXISTS idx_items_query      ON items(query);
CREATE INDEX IF NOT EXISTS idx_hotspots_published ON hotspots(published_at);
CREATE INDEX IF NOT EXISTS idx_hotspots_engagement ON hotspots(engagement_magnitude);
CREATE INDEX IF NOT EXISTS idx_alert_trigered   ON alert_logs(triggered_at);
`;

/** 幂等迁移：为旧库的 hotspots 补 detail 列（engagement_magnitude 互动量反规范化 / engagement_json 互动细分反规范化 / ai_reasons AI 判定+相关度理由）。
 *  必须在执行 schema（含其索引）之前调用。 */
function migrateHotspotDetailColumns(): void {
  const cols = db.prepare(`PRAGMA table_info(hotspots)`).all() as { name: string }[];
  const has = (n: string) => cols.some((c) => c.name === n);
  if (!has('engagement_magnitude')) {
    db.exec('ALTER TABLE hotspots ADD COLUMN engagement_magnitude INTEGER NOT NULL DEFAULT 0');
  }
  if (!has('engagement_json')) {
    db.exec(`ALTER TABLE hotspots ADD COLUMN engagement_json TEXT NOT NULL DEFAULT '{}'`);
  }
  if (!has('ai_reasons')) {
    db.exec('ALTER TABLE hotspots ADD COLUMN ai_reasons TEXT');
  }
}

export function migrate(): void {
  // 先补列再跑建表/建索引（schema 中的 idx_hotspots_engagement 依赖该列）
  migrateHotspotDetailColumns();
  db.exec(schema);
}

export function nowIso(): string {
  return new Date().toISOString();
}