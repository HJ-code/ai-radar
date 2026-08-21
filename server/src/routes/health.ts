import { Router } from 'express';
import { db } from '../db/conn.ts';

export const router = Router();

router.get('/health', (_req, res) => {
  let dbConnected = false;
  try {
    db.prepare('SELECT 1').get();
    dbConnected = true;
  } catch {
    dbConnected = false;
  }
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    dbConnected,
    version: '0.1.0',
  });
});