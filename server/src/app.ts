import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountApi } from './routes/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 前端构建产物目录（server/../client/dist）
const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  // 本地开发 CORS（放开；客户端经 Vite 代理时为同源）
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  mountApi(app);

  // 生产托管：存在前端构建产物时，单进程同时服务静态页面（非 /api 的 GET 回退到 index.html）
  if (existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[error]', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}