import { addAlert } from '../repositories/alerts.ts';
import { broadcastSse } from '../services/sse.ts';
import type { AlertContext, Notifier } from './types.ts';

/** 站内通知：写入 alert_logs + 广播到 SSE（前端据此弹浏览器通知、角标） */
export const inappNotifier: Notifier = {
  channel: 'inapp',
  async notify(ctx: AlertContext) {
    addAlert({ keyword: ctx.keyword, title: ctx.title, url: ctx.url });
    broadcastSse(
      {
        keyword: ctx.keyword,
        title: ctx.title,
        url: ctx.url,
        sourceKey: ctx.sourceKey,
        aiStatus: ctx.aiStatus,
        relevance: ctx.relevance,
        summaryZh: ctx.summaryZh,
        hotspotId: ctx.hotspotId,
        at: new Date().toISOString(),
      },
      'alert',
    );
  },
};