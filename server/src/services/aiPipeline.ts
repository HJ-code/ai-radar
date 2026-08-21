import { config } from '../config.ts';
import { listUnscored, markItemNotified, updateItemAi } from '../repositories/items.ts';
import type { ItemRow } from '../repositories/types.ts';
import { insertHotspotIfAbsent } from '../repositories/hotspots.ts';
import { listEnabledKeywords, markKeywordTriggered } from '../repositories/keywords.ts';
import { listEnabledRanges } from '../repositories/ranges.ts';
import { AiClient, AiError } from '../ai/client.ts';
import { buildAnalysisMessages, type ScopeCtx } from '../ai/prompts.ts';
import type { AiAnalysis, AiVerdict, AnalysisItemCtx } from '../ai/types.ts';
import { dispatchNotify } from './notifier.ts';

export interface AiRunReport {
  processed: number;
  mode: 'ai' | 'probe' | 'rules' | 'none' | 'skipped';
}

/** 保存最近一次 AI 处理时间，供外部做冷却判断 */
export const aiRuntime = { lastRunAt: 0 };

export interface AiStatusInfo {
  configured: boolean;
  baseUrl: string;
  model: string;
  apiKeyPresent: boolean;
  minRelevance: number;
  maxPerRun: number;
  timeoutMs: number;
  cooldownMs: number;
  failStreak: number;
}

const AI_MAX_STREAK = 3;
let failStreak = 0;
let client: AiClient | null | undefined;

function getClient(): AiClient | null {
  const { baseUrl, apiKey, model } = config.ai;
  if (!baseUrl || !apiKey || !model) return null;
  if (client === undefined) {
    client = new AiClient({ baseUrl, apiKey, model, timeoutMs: config.ai.timeoutMs });
  }
  return client;
}

export function aiStatus(): AiStatusInfo {
  const c = getClient();
  return {
    configured: Boolean(c),
    baseUrl: config.ai.baseUrl || '',
    model: config.ai.model || '',
    apiKeyPresent: Boolean(config.ai.apiKey),
    minRelevance: config.ai.minRelevance,
    maxPerRun: config.ai.maxPerRun,
    timeoutMs: config.ai.timeoutMs,
    cooldownMs: config.ai.cooldownMs,
    failStreak,
  };
}

export function buildScope(): ScopeCtx {
  const keywords = listEnabledKeywords()
    .map((k) => k.keyword.trim())
    .filter(Boolean);
  const ranges = listEnabledRanges()
    .flatMap((r) => r.queriesCsv.split(',').map((s) => s.trim()).filter(Boolean));
  return { keywords, ranges };
}

function ctxOf(item: ItemRow): AnalysisItemCtx {
  return {
    title: item.title,
    text: item.text,
    author: item.author,
    sourceKey: item.sourceKey,
    publishedAt: item.publishedAt,
    engagementJson: item.engagementJson,
    url: item.url,
  };
}

/** 从 LLM 原始 JSON 结果归一化，字段不合规时取安全默认值 */
export function normalizeAnalysis(raw: unknown): AiAnalysis {
  const o = (raw ?? {}) as Record<string, unknown>;
  const v = String(o.verdict ?? '');
  const verdict: AiVerdict = v === 'real' || v === 'fake' ? v : 'doubtful';
  const relevance = Math.max(0, Math.min(100, Math.round(Number(o.relevance) || 0)));
  const summary = typeof o.summary === 'string' ? o.summary.slice(0, 80) : '';
  const reasons = typeof o.reasons === 'string' ? o.reasons.slice(0, 80) : '';
  return { verdict, relevance, summary, reasons };
}

/** 从 engagement_json 提取一个总的互动量级数字（各源字段不同，取最大值） */
export function engagementMagnitude(engagementJson: string): number {
  let obj: unknown;
  try { obj = JSON.parse(engagementJson || '{}'); } catch { return 0; }
  if (!obj || typeof obj !== 'object') return 0;
  const numericKeys = ['points', 'score', 'stars', 'downloads', 'likes', 'comments', 'num_comments', 'forks', 'ups'];
  let max = 0;
  for (const entry of Object.entries(obj as Record<string, unknown>)) {
    const [k, v] = entry;
    if (numericKeys.includes(k) && typeof v === 'number' && Number.isFinite(v)) {
      max = Math.max(max, v);
    }
  }
  return max;
}

/** 规则级相关度 0-100（AI 不可用时的降级） */
export function ruleRelevance(item: ItemRow, scope: ScopeCtx): number {
  const title = (item.title ?? '').toLowerCase();
  const text = (item.text ?? '').toLowerCase();
  const url = (item.url ?? '').toLowerCase();
  let score = 40;
  for (const k of scope.keywords) {
    const t = k.toLowerCase();
    if (title.includes(t)) score += 45;
    else if (text.includes(t)) score += 25;
  }
  for (const r of scope.ranges) {
    const t = r.toLowerCase();
    if (title.includes(t)) score += 20;
    else if (text.includes(t)) score += 10;
  }
  if (item.query) {
    const q = item.query.toLowerCase();
    if (title.includes(q) || text.includes(q)) score += 5;
  }
  return Math.min(100, score);
}

function bestRangeName(item: ItemRow): string | null {
  if (!item.query) return null;
  const q = item.query.toLowerCase();
  for (const r of listEnabledRanges()) {
    const matched = r.queriesCsv
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .includes(q);
    if (matched) return r.name;
  }
  return null;
}

/** hotScore = 相关度 × log10(互动量+10)；存疑降权一半 */
function hotScoreFor(relevance: number, magnitude: number, verdict?: AiVerdict): number {
  const base = Math.round(relevance * Math.log10(magnitude + 10));
  return verdict === 'doubtful' ? Math.round(base * 0.5) : base;
}

function persistHotspot(item: ItemRow, aiStatus: string, aiRelevance: number, summaryZh: string | null, verdict?: AiVerdict): { inserted: boolean; id: number } | null {
  if (!item.url) return null;
  return insertHotspotIfAbsent({
    itemId: item.id,
    title: item.title ?? '（无标题）',
    text: item.text,
    url: item.url,
    sourceKey: item.sourceKey,
    author: item.author,
    hotScore: hotScoreFor(aiRelevance, engagementMagnitude(item.engagementJson), verdict),
    rangeName: bestRangeName(item),
    aiStatus,
    aiRelevance,
    summaryZh,
    publishedAt: item.publishedAt ?? item.collectedAt,
  });
}

/** 关键词是否命中条目的标题/正文/URL */
function topicHit(item: ItemRow, keyword: string): boolean {
  const kw = keyword.toLowerCase();
  const hay = `${item.title ?? ''}\n${item.text ?? ''}\n${item.url ?? ''}`.toLowerCase();
  return hay.includes(kw);
}

/**
 * 命中启用关键词才告警：
 * 条件为 AI 判定 real、且本条是本轮新插入的热点（避免回放存量刷屏）、且尚未通知过。
 */
async function maybeNotify(item: ItemRow, hotspotId: number, a: AiAnalysis): Promise<void> {
  const matched = listEnabledKeywords().filter((k) => topicHit(item, k.keyword));
  if (!matched.length) return;
  for (const k of matched) {
    await dispatchNotify({
      keyword: k.keyword,
      title: item.title,
      url: item.url,
      sourceKey: item.sourceKey,
      aiStatus: a.verdict,
      relevance: a.relevance,
      summaryZh: a.summary || null,
      hotspotId,
    });
    markKeywordTriggered(k.id, hotspotId);
  }
  markItemNotified(item.id);
}

/** AI 三道关结果落地：更新条目 + 相关且非虚假 → 写热点（存疑降权、虚假隐藏）；real 且新热点 → 告警 */
async function applyAi(item: ItemRow, a: AiAnalysis): Promise<void> {
  updateItemAi(item.id, { aiStatus: a.verdict, aiRelevance: a.relevance, summaryZh: a.summary || null });
  if (a.verdict === 'fake' || a.relevance < config.ai.minRelevance) return;
  const hs = persistHotspot(item, a.verdict, a.relevance, a.summary || null, a.verdict);
  if (!hs) return;
  if (hs.inserted && a.verdict === 'real' && !item.notified) {
    await maybeNotify(item, hs.id, a);
  }
}

/** AI 不可用时的规则降级：仍打「未鉴定」标记并入库热点，功能不中断 */
function applyRules(item: ItemRow, scope: ScopeCtx): void {
  const relevance = ruleRelevance(item, scope);
  updateItemAi(item.id, { aiStatus: 'unscored', aiRelevance: relevance, summaryZh: null });
  if (relevance < config.ai.minRelevance) return;
  persistHotspot(item, 'unscored', relevance, null);
}

/**
 * 处理待鉴定条目：
 * - 未配置 AI → 全量规则降级；
 * - 连续失败达上限 → 用第一条做恢复探测（probe），其余降级；
 * - 成功 → 三道关 AI 处理，失败的单条回落规则、软件中断。
 * 自身带冷却，避免高频轮询时打爆 AI 端点。
 */
export async function processPendingItems(): Promise<AiRunReport> {
  const now = Date.now();
  if (aiRuntime.lastRunAt && now - aiRuntime.lastRunAt < config.ai.cooldownMs) {
    return { processed: 0, mode: 'skipped' };
  }
  aiRuntime.lastRunAt = now;

  const items = listUnscored(config.ai.maxPerRun);
  if (!items.length) return { processed: 0, mode: 'none' };

  const scope = buildScope();
  const c = getClient();
  if (!c) {
    for (const item of items) applyRules(item, scope);
    return { processed: items.length, mode: 'rules' };
  }

  let mode: AiRunReport['mode'] = failStreak >= AI_MAX_STREAK ? 'probe' : 'ai';
  let aiOk = mode === 'ai';
  let processed = 0;

  for (const item of items) {
    if (aiOk || mode === 'probe') {
      try {
        const raw = await c.completeJson<any>(buildAnalysisMessages(ctxOf(item), scope));
        const analysis = normalizeAnalysis(raw);
        failStreak = 0;
        aiOk = true;
        mode = 'ai';
        await applyAi(item, analysis);
        processed += 1;
        continue;
      } catch (err) {
        failStreak += 1;
        if (mode === 'probe') break; // 恢复探测失败：本轮剩余全部走规则，探针条目留待下轮
        aiOk = false; // AI 模式下首次失败：本条回落规则，后续同批也走规则
      }
    }
    applyRules(item, scope);
    processed += 1;
  }

  return { processed, mode: aiOk ? 'ai' : 'rules' };
}

const SAMPLE_ITEM: ItemRow = {
  id: -1,
  sourceKey: 'sample',
  externalId: 'sample',
  title: 'OpenAI 发布 GPT-6 大模型，推理能力显著提升',
  text: 'OpenAI 宣布新一代旗舰模型 GPT-6 正式发布，在数学推理与代码生成上表现大幅提升，即日起对开发者开放 API。',
  url: 'https://example.com/gpt6',
  author: 'OpenAI 官方账号',
  authorUrl: null,
  publishedAt: new Date().toISOString(),
  collectedAt: new Date().toISOString(),
  query: 'GPT',
  engagementJson: '{"points": 3500, "comments": 420}',
  rawJson: '{}',
  aiStatus: 'unscored',
  aiRelevance: 0,
  summaryZh: null,
  notified: false,
  aiAt: null,
};

/** 供 POST /api/system/ai/test 使用的连通性验证：不写库，跑一次完整三道关 */
export async function probeAi(): Promise<{ usedSample: boolean; analysis: AiAnalysis; item: AnalysisItemCtx }> {
  const latest = listUnscored(1)[0] ?? null;
  const item: ItemRow = latest ?? SAMPLE_ITEM;
  const c = getClient();
  if (!c) {
    throw new AiError('AI 未配置：请在 server/.env 设置 AI_BASE_URL / AI_API_KEY / AI_MODEL 后重启');
  }
  const raw = await c.completeJson<any>(buildAnalysisMessages(ctxOf(item), buildScope()));
  return { usedSample: !latest, analysis: normalizeAnalysis(raw), item: ctxOf(item) };
}