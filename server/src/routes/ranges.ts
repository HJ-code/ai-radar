import { Router } from 'express';
import {
  listRanges,
  createRange,
  updateRange,
  deleteRange,
} from '../repositories/ranges.ts';

export const router = Router();

router.get('/', (_req, res) => {
  res.json(listRanges());
});

router.post('/', (req, res) => {
  const { name, description, queriesCsv, enabled } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }
  const created = createRange({ name, description: description ?? '', queriesCsv: queriesCsv ?? '', enabled });
  return res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const updated = updateRange(id, {
    name: req.body?.name,
    description: req.body?.description,
    queriesCsv: req.body?.queriesCsv,
    enabled: req.body?.enabled,
  });
  if (!updated) return res.status(404).json({ error: 'range not found' });
  return res.json(updated);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const ok = deleteRange(id);
  if (!ok) return res.status(404).json({ error: 'range not found' });
  return res.status(204).end();
});