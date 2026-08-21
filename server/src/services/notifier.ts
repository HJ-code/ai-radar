import { getNotifiers } from '../notifiers/registry.ts';
import type { AlertContext } from '../notifiers/types.ts';

export interface NotifyResult {
  channels: string[];
  failed: string[];
}

/** 分发一条告警到所有已注册渠道；单渠道失败不中断其他渠道 */
export async function dispatchNotify(ctx: AlertContext): Promise<NotifyResult> {
  const channels: string[] = [];
  const failed: string[] = [];
  for (const n of getNotifiers()) {
    try {
      await n.notify(ctx);
      channels.push(n.channel);
    } catch (err) {
      failed.push(`${n.channel}: ${(err as Error).message}`);
    }
  }
  return { channels, failed };
}