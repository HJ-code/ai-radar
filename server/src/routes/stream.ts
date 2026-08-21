import { Router } from 'express';
import { subscribeSse } from '../services/sse.ts';

export const router = Router();

// 实时事件流：新热点 `hotspot` 事件、告警 `alert` 事件（SSE）
router.get('/stream/hotspots', (req, res) => {
  subscribeSse(res);
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, 25_000);
  res.on('close', () => clearInterval(heartbeat));
});