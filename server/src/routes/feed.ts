import { Router } from 'express';
import { countItems, latestCollectedAt, listItems } from '../repositories/items.ts';
import { countHotspots, latestHotspotCreatedAt, listHotspots } from '../repositories/hotspots.ts';
import { countKeywords, listEnabledKeywords } from '../repositories/keywords.ts';
import { countAlerts } from '../repositories/alerts.ts';
import { runOnce } from '../services/runner.ts';

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

function parseBefore(raw: string | undefined): { publishedAt: string; hotScore: number; id: number } | null {
  if (!raw) return null;
  const [pa, hs, idRaw] = raw.split('|');
  const hotScore = Number(hs);
  const id = Number(idRaw);
  if (!pa || !Number.isFinite(hotScore) || !Number.isFinite(id)) return null;
  return { publishedAt: pa, hotScore, id };
}

router.get('/hotspots', (req, res) => {
  const keywords = listEnabledKeywords()
    .map((k) => k.keyword.trim())
    .filter(Boolean);
  res.json(
    listHotspots({
      limit: Number(req.query.limit) || 50,
      rangeName: req.query.range as string | undefined,
      status: req.query.status as string | undefined,
      before: parseBefore(req.query.before as string | undefined),
    }).map((h) => ({
      ...h,
      keywords: keywords.filter((k) => topicHitFor(h, k)),
    })),
  );
});

router.post('/collect/now', async (_req, res) => {
  const result = await runOnce({ force: true });
  res.json(result);
});