import type { Response } from 'express';

/** 进程内 SSE 客户端集合：广播新热点事件与告警事件 */
const clients = new Set<Response>();

export function subscribeSse(res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
  clients.add(res);
  res.on('close', () => {
    clients.delete(res);
  });
}

export function broadcastSse(payload: unknown, event?: string): void {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  const framed = event ? `event: ${event}\n${data}` : data;
  for (const c of clients) {
    if (!c.writableEnded) c.write(framed);
  }
}

export function sseClientCount(): number {
  return clients.size;
}