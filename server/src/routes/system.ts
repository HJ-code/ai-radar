import { Router } from 'express';
import { aiStatus, probeAi, setAiEnabled } from '../services/aiPipeline.ts';

export const router = Router();

// AI 服务当前配置与运行时状态（仅反映 .env / 运行时，不返回密钥明文）
router.get('/ai', (_req, res) => {
  res.json(aiStatus());
});

// 运行时启停 AI（持久化到 settings 表，免改 .env 重启）
router.post('/ai/enabled', (req, res) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled 必须是布尔值' });
  }
  setAiEnabled(enabled);
  res.json({ ok: true, ...aiStatus() });
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