import { Router } from 'express';
import { listAlerts } from '../repositories/alerts.ts';
import { dispatchNotify } from '../services/notifier.ts';

export const router = Router();

// 通知日志
router.get('/', (req, res) => {
  res.json(listAlerts({ limit: Number(req.query.limit) || 50 }));
});

// 触发一条测试告警（写日志 + SSE 广播），供前端验证浏览器通知链路
router.post('/notify/test', async (_req, res) => {
  try {
    const result = await dispatchNotify({
      keyword: '测试',
      title: '通知链路测试',
      url: 'http://localhost:5188',
      sourceKey: 'system',
      aiStatus: 'real',
      relevance: 90,
      summaryZh: '这是一条用于验证通知链路的测试消息',
      hotspotId: 0,
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(502).json({ ok: false, error: (err as Error).message });
  }
});