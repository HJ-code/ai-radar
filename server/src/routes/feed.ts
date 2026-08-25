import { Router } from 'express';
import { countItems, latestCollectedAt, listItems } from '../repositories/items.ts';
import { countHotspots, latestHotspotCreatedAt, listHotspots, type HotspotSortKey } from '../repositories/hotspots.ts';
import { countKeywords, listEnabledKeywords } from '../repositories/keywords.ts';
import { countAlerts } from '../repositories/alerts.ts';
import { runOnce } from '../services/runner.ts';

const VALID_SORTS: HotspotSortKey[] = ['smart', 'published', 'collected', 'hot', 'engagement', 'relevance'];
const VALID_STATUSES = ['real', 'doubtful', 'fake', 'unscored'];

function csvList(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const arr = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}

function parseCursor(raw: unknown): (string | number)[] | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  return raw.split('|').map((p) => (p.trim() === '' ? p : /^-?\d+(\.\d+)?$/.test(p) ? Number(p) : p));
}

export const router = Router();

router.get('/stats', (_req, res) => {
  res.json({
    items: countItems(),
    hotspots: countHotspots(),
    keywords: countKeywords(),
    keywordEnabled: listEnabledKeywords().length,
    alerts: countAlerts(),
    lastCollect: latestCollectedAt(),
    lastHotspot: latestHotspotCreatedAt(),
  });
});

router.get('/items', (req, res) => {
  res.json(
    listItems({
      limit: Number(req.query.limit) || 50,
      sourceKey: req.query.sourceKey as string | undefined,
      status: req.query.status as string | undefined,
      q: req.query.q as string | undefined,
    }),
  );
});

function topicHitFor(h: { title: string; text: string | null; url: string }, keyword: string): boolean {
  const kw = keyword.toLowerCase();
  const hay = `${h.title ?? ''}\n${h.text ?? ''}\n${h.url ?? ''}`.toLowerCase();
  return hay.includes(kw);
}

/** 解析互动细分 JSON；非对象/损坏返回空对象 */
function parseEngagement(raw: string | null): Record<string, unknown> {
  try {
    const o = raw && raw !== '{}' ? JSON.parse(raw) : null;
    return o && typeof o === 'object' ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** 解析 AI 依据 JSON（`{"verdict":..,"relevance":..}`）；无则返回 null，前端隐藏折叠区 */
function parseAiReasons(raw: string | null): { verdict?: string; relevance?: string } | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const verdict = typeof o.verdict === 'string' && o.verdict ? o.verdict : undefined;
    const relevance = typeof o.relevance === 'string' && o.relevance ? o.relevance : undefined;
    return verdict || relevance ? { verdict, relevance } : null;
  } catch {
    return null;
  }
}

router.get('/hotspots', (req, res) => {
  const keywords = listEnabledKeywords()
    .map((k) => k.keyword.trim())
    .filter(Boolean);

  const sortRaw = req.query.sort as string | undefined;
  const sort: HotspotSortKey = VALID_SORTS.includes(sortRaw as HotspotSortKey) ? (sortRaw as HotspotSortKey) : 'smart';
  const order: 'asc' | 'desc' = req.query.order === 'asc' ? 'asc' : 'desc';

  const sources = csvList(req.query.source);
  const statuses = (csvList(req.query.status) ?? []).filter((s) => VALID_STATUSES.includes(s));
  const type: 'news' | 'interactive' | undefined =
    req.query.type === 'news' || req.query.type === 'interactive' ? req.query.type : undefined;

  const num = (v: unknown): number | undefined => {
    if (typeof v !== 'string' || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const filter = {
    limit: Math.min(200, Number(req.query.limit) || 50),
    sort,
    order,
    rangeName: (req.query.range as string | undefined) || undefined,
    sources,
    statuses: statuses.length ? statuses : undefined,
    since: (req.query.since as string | undefined) || undefined,
    until: (req.query.until as string | undefined) || undefined,
    type,
    relevanceMin: num(req.query.relevanceMin),
    relevanceMax: num(req.query.relevanceMax),
    scoreMin: num(req.query.scoreMin),
    scoreMax: num(req.query.scoreMax),
    q: (req.query.q as string | undefined)?.trim() || undefined,
    author: (req.query.author as string | undefined)?.trim() || undefined,
    before: parseCursor(req.query.before),
  };

  const { items, next, total } = listHotspots(filter);
  res.json({
    items: items.map((h) => ({
      ...h,
      engagement: parseEngagement(h.engagementJson),
      aiReasons: parseAiReasons(h.aiReasons),
      keywords: keywords.filter((k) => topicHitFor(h, k)),
    })),
    next,
    total,
  });
});

router.post('/collect/now', async (_req, res) => {
  const result = await runOnce({ force: true });
  res.json(result);
});