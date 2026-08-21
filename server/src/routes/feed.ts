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

router.get('/hotspots', (req, res) => {
  res.json(
    listHotspots({
      limit: Number(req.query.limit) || 50,
      rangeName: req.query.range as string | undefined,
      status: req.query.status as string | undefined,
    }),
  );
});

router.post('/collect/now', async (_req, res) => {
  const result = await runOnce({ force: true });
  res.json(result);
});