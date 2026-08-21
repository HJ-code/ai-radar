export interface AlertContext {
  keyword: string;
  title: string | null;
  url: string | null;
  sourceKey: string;
  aiStatus: string;
  relevance: number;
  summaryZh: string | null;
  hotspotId: number;
}

/** 可插拔通知渠道：二期注册 webhook/email 即接入 */
export interface Notifier {
  readonly channel: string;
  notify(ctx: AlertContext): Promise<void>;
}