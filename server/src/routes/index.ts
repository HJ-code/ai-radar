import { Router } from 'express';
import type { Express } from 'express';
import { router as healthRouter } from './health.ts';
import { router as sourcesRouter } from './sources.ts';
import { router as rangesRouter } from './ranges.ts';
import { router as keywordsRouter } from './keywords.ts';
import { router as feedRouter } from './feed.ts';
import { router as systemRouter } from './system.ts';
import { router as alertsRouter } from './alerts.ts';
import { router as streamRouter } from './stream.ts';

export function mountApi(app: Express): void {
  const api = Router();

  api.use(healthRouter); // /api/health
  api.use('/sources', sourcesRouter);
  api.use('/ranges', rangesRouter);
  api.use('/keywords', keywordsRouter);
  api.use('/system', systemRouter); // /api/system/ai · /api/system/ai/test
  api.use('/alerts', alertsRouter); // /api/alerts · /api/alerts/notify/test
  api.use(streamRouter); // /api/stream/hotspots
  api.use(feedRouter); // /api/stats · /api/items · /api/hotspots · /api/collect/now

  app.use('/api', api);
}