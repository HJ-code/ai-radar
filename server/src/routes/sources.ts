import { Router } from 'express';
import { listSources, toggleSource, updateSource } from '../repositories/sources.ts';

export const router = Router();

router.get('/', (_req, res) => {
  res.json(listSources());
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const updated = updateSource(id, {
    enabled: req.body?.enabled,
    apiKey: req.body?.apiKey,
    intervalMinutes: req.body?.intervalMinutes,
    extraJson: req.body?.extraJson,
    displayName: req.body?.displayName,
  });
  if (!updated) return res.status(404).json({ error: 'source not found' });
  return res.json(updated);
});

router.post('/:id/toggle', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const toggled = toggleSource(id);
  if (!toggled) return res.status(404).json({ error: 'source not found' });
  return res.json(toggled);
});