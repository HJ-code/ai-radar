import { runOnce } from './runner.ts';

let timer: NodeJS.Timeout | null = null;

/** 每 intervalMs 检查一次到期源；启动时立即跑一轮填充数据 */
export function startScheduler(intervalMs = 20_000): void {
  stopScheduler();
  void runOnce().catch((err) => console.error('[scheduler] initial run failed:', (err as Error).message));
  timer = setInterval(() => {
    void runOnce().catch((err) => console.error('[scheduler] run failed:', (err as Error).message));
  }, intervalMs);
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}