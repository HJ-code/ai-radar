import { config } from '../config.ts';
import { listUnscored, markItemNotified, updateItemAi, countUnscored } from '../repositories/items.ts';
import type { ItemRow } from '../repositories/types.ts';
import { insertHotspotIfAbsent } from '../repositories/hotspots.ts';
import { listEnabledKeywords, markKeywordTriggered } from '../repositories/keywords.ts';
import { listEnabledRanges } from '../repositories/ranges.ts';
import { listSources } from '../repositories/sources.ts';
import { getSetting, setSetting } from '../repositories/settings.ts';
import { getExtra } from '../util/helpers.ts';
import { engagementMagnitude } from '../util/helpers.ts';
import { AiClient, AiError } from '../ai/client.ts';
import { buildAnalysisMessages, type ScopeCtx } from '../ai/prompts.ts';
import type { AiAnalysis, AiVerdict, AnalysisItemCtx } from '../ai/types.ts';
import { dispatchNotify } from './notifier.ts';

export interface AiRunReport {
  processed: number;
  mode: 'ai' | 'probe' | 'rules' | 'none' | 'skipped';
}

/** 保存最近一次 AI 处理信息，供外部做冷却判断与进度展示 */
export const aiRuntime = {
  lastRunAt: 0,
  lastProcessed: 0,
  lastMode: 'none' as AiRunReport['mode'],
};

export interface AiStatusInfo {
  configured: boolean;
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKeyPresent: boolean;
  minRelevance: number;
  maxPerRun: number;
  timeoutMs: number;
  cooldownMs: number;
  failStreak: number;
  /** 待鉴定队列长度 */
  pendingCount: number;
  /** 距下次允许自动处理的剩余毫秒；0 = 可立即处理 */
  cooldownRemainingMs: number;
  /** 最近一次处理的起始时间（epoch ms）；从未处理为 0 */
  lastProcessedAt: number;
  lastMode: AiRunReport['mode'];
}

const AI_MAX_STREAK = 3;
const AI_ENABLED_SETTING = 'ai_runtime_enabled';
let failStreak = 0;
let client: AiClient | null | undefined;
let runtimeEnabled: boolean | null = null;

/**
 * AI 运行时开关（面板可调，持久化到 settings 表；首次读取时以 DB > .env 为优先）。
 * 关闭后 getClient 返回 null，流水线自动降级为规则模式，零外部调用。
 */
function effectiveEnabled(): boolean {
  if (runtimeEnabled === null) {
    const persisted = getSetting(AI_ENABLED_SETTING);
    runtimeEnabled = persisted === null ? config.ai.enabled : persisted === '1';
  }
  return runtimeEnabled;
}

export function isAiEnabled(): boolean {
  return effectiveEnabled();
}

export function setAiEnabled(v: boolean): void {
  runtimeEnabled = v;
  setSetting(AI_ENABLED_SETTING, v ? '1' : '0');
}

function getClient(): AiClient | null {
  const { baseUrl, apiKey, model } = config.ai;
  if (!effectiveEnabled() || !baseUrl || !apiKey || !model) return null;
  if (client === undefined) {
    client = new AiClient({ baseUrl, apiKey, model, timeoutMs: config.ai.timeoutMs });
  }
  return client;
}

export function aiStatus(): AiStatusInfo {
  const creds = Boolean(config.ai.baseUrl && config.ai.apiKey && config.ai.model);
  const now = Date.now();
  const last = aiRuntime.lastRunAt;
  const cooldownRemainingMs = last ? Math.max(0, config.ai.cooldownMs - (now - last)) : 0;
  return {
    configured: creds,
    enabled: effectiveEnabled(),
    baseUrl: config.ai.baseUrl || '',
    model: config.ai.model || '',
    apiKeyPresent: Boolean(config.ai.apiKey),
    minRelevance: config.ai.minRelevance,
    maxPerRun: config.ai.maxPerRun,
    timeoutMs: config.ai.timeoutMs,
    cooldownMs: config.ai.cooldownMs,
    failStreak,
    pendingCount: countUnscored(),
    cooldownRemainingMs,
    lastProcessedAt: last,
    lastMode: aiRuntime.lastMode,
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

/** 各交互型源的互动准入门槛；数值可被源 extraJson 的 min<字段> 覆盖。RSS 等资讯型源不在此表内 → 豁免。 */
const ENGAGEMENT_GATES: Record<string, { field: string; min: number; or?: { field: string; min: number } }> = {
  hackernews: { field: 'points', min: 50 },
  github: { field: 'stars', min: 500 },
  bilibili: { field: 'view', min: 10_000, or: { field: 'like', min: 200 } },
  reddit: { field: 'score', min: 50 },
  huggingface: { field: 'downloads', min: 1_000 },
};

function engagementValue(item: ItemRow, field: string): number {
  try {
    const o = JSON.parse(item.engagementJson || '{}') as Record<string, unknown>;
    const v = o[field];
    return typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

/** 互动门槛：不达标的内容不视为「热点」（主字段不达标时可用 or 字段兜底）；无门槛来源放行 */
export function passesEngagementGate(item: ItemRow, extra: Record<string, unknown>): boolean {
  const gate = ENGAGEMENT_GATES[item.sourceKey];
  if (!gate) return true;
  const cap = (f: string) => `min${f[0].toUpperCase()}${f.slice(1)}`;
  const min = Number(extra[cap(gate.field)] ?? gate.min);
  const v = engagementValue(item, gate.field);
  if (!Number.isNaN(v) && v >= min) return true;
  if (gate.or) {
    const orMin = Number(extra[cap(gate.or.field)] ?? gate.or.min);
    const ov = engagementValue(item, gate.or.field);
    if (!Number.isNaN(ov) && ov >= orMin) return true;
  }
  return false;
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
    engagementMagnitude: engagementMagnitude(item.engagementJson),
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

/** AI 三道关结果落地：更新条目 + 相关且非虚假且互动达标 → 写热点（存疑降权、虚假隐藏）；real 且新热点 → 告警 */
async function applyAi(item: ItemRow, a: AiAnalysis, gatePass: boolean): Promise<void> {
  updateItemAi(item.id, { aiStatus: a.verdict, aiRelevance: a.relevance, summaryZh: a.summary || null });
  if (a.verdict === 'fake' || a.relevance < config.ai.minRelevance || !gatePass) return;
  const hs = persistHotspot(item, a.verdict, a.relevance, a.summary || null, a.verdict);
  if (!hs) return;
  if (hs.inserted && a.verdict === 'real' && !item.notified) {
    await maybeNotify(item, hs.id, a);
  }
}

/** AI 不可用时的规则降级：仍打「未鉴定」标记并入库热点（互动达标才入），功能不中断 */
function applyRules(item: ItemRow, scope: ScopeCtx, gatePass: boolean): void {
  const relevance = ruleRelevance(item, scope);
  updateItemAi(item.id, { aiStatus: 'unscored', aiRelevance: relevance, summaryZh: null });
  if (relevance < config.ai.minRelevance || !gatePass) return;
  persistHotspot(item, 'unscored', relevance, null);
}

/** 处理一批（最多 maxPerRun 条）：AI 三道关或规则降级；不检查冷却（由上层决定） */
async function runBatch(): Promise<AiRunReport> {
  aiRuntime.lastRunAt = Date.now();
  const items = listUnscored(config.ai.maxPerRun);
  if (!items.length) return { processed: 0, mode: 'none' };

  const scope = buildScope();
  const srcExtra = new Map(listSources().map((s) => [s.sourceKey, getExtra(s)]));
  const gatePass = (item: ItemRow) => passesEngagementGate(item, srcExtra.get(item.sourceKey) ?? {});
  const c = getClient();
  if (!c) {
    for (const item of items) applyRules(item, scope, gatePass(item));
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
        await applyAi(item, analysis, gatePass(item));
        processed += 1;
        continue;
      } catch (err) {
        failStreak += 1;
        if (mode === 'probe') break; // 恢复探测失败：本轮剩余全部走规则，探针条目留待下轮
        aiOk = false; // AI 模式下首次失败：本条回落规则，后续同批也走规则
      }
    }
    applyRules(item, scope, gatePass(item));
    processed += 1;
  }

  return { processed, mode: aiOk ? 'ai' : 'rules' };
}

/**
 * 处理待鉴定条目：
 * - 默认（调度器自动轮询）：带冷却，避免高频轮询打爆 AI 端点；
 * - skipCooldown（手动采集触发）：忽略冷却，循环把队列尽量处理完（波次上限防极端积压阻塞）。
 * 无论哪种模式：未配置 AI → 规则降级；连续失败达上限 → 探针再失败回落规则。
 */
export async function processPendingItems(opts: { skipCooldown?: boolean } = {}): Promise<AiRunReport> {
  const now = Date.now();
  if (!opts.skipCooldown && aiRuntime.lastRunAt && now - aiRuntime.lastRunAt < config.ai.cooldownMs) {
    return { processed: 0, mode: 'skipped' };
  }

  if (opts.skipCooldown) {
    const MAX_FORCED_WAVES = 5;
    let total = 0;
    let lastGood: AiRunReport | null = null;
    for (let wave = 0; wave < MAX_FORCED_WAVES; wave++) {
      const r = await runBatch();
      if (r.processed > 0 || r.mode === 'rules') lastGood = r;
      total += r.processed;
      if (r.processed === 0) break; // 队列清空或探针无进展，防死循环
    }
    const final = lastGood ?? { processed: total, mode: 'none' as AiRunReport['mode'] };
    aiRuntime.lastProcessed = final.processed;
    aiRuntime.lastMode = final.mode;
    return final;
  }

  const r = await runBatch();
  if (r.mode !== 'none') {
    aiRuntime.lastProcessed = r.processed;
    aiRuntime.lastMode = r.mode;
  }
  return r;
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