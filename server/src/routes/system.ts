import { Router } from 'express';
import { aiStatus, probeAi } from '../services/aiPipeline.ts';

export const router = Router();

// AI 服务当前配置与运行时状态（仅反映 .env / 运行时，不返回密钥明文）
router.get('/ai', (_req, res) => {
  res.json(aiStatus());
});

// 连通性验证：跑一次完整三道关（不落库）
router.post('/ai/test', async (_req, res) => {
  try {
    const started = Date.now();
    const { usedSample, analysis, item } = await probeAi();
    res.json({ ok: true, latencyMs: Date.now() - started, usedSample, item, analysis });
  } catch (err) {
    res.status(502).json({ ok: false, error: (err as Error).message });
  }
});