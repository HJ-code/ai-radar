import { Router } from 'express';
import {
  listKeywords,
  createKeyword,
  updateKeyword,
  deleteKeyword,
} from '../repositories/keywords.ts';

export const router = Router();

router.get('/', (_req, res) => {
  res.json(listKeywords());
});

router.post('/', (req, res) => {
  const { keyword, note, enabled } = req.body ?? {};
  if (!keyword || typeof keyword !== 'string') {
    return res.status(400).json({ error: 'keyword is required' });
  }
  const created = createKeyword({ keyword, note: note ?? '', enabled });
  return res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const updated = updateKeyword(id, {
    keyword: req.body?.keyword,
    note: req.body?.note,
    enabled: req.body?.enabled,
  });
  if (!updated) return res.status(404).json({ error: 'keyword not found' });
  return res.json(updated);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const ok = deleteKeyword(id);
  if (!ok) return res.status(404).json({ error: 'keyword not found' });
  return res.status(204).end();
});