export interface SourceRow {
  id: number;
  sourceKey: string;
  displayName: string;
  enabled: boolean;
  apiKey: string | null;
  intervalMinutes: number;
  lastRunAt: string | null;
  extraJson: string;
}

export interface RangeRow {
  id: number;
  name: string;
  description: string;
  queriesCsv: string;
  enabled: boolean;
  createdAt: string;
}

export interface KeywordRow {
  id: number;
  keyword: string;
  note: string;
  enabled: boolean;
  createdAt: string;
  lastTriggeredAt: string | null;
  triggerCount: number;
  lastHotspotId: number | null;
}

export interface ItemRow {
  id: number;
  sourceKey: string;
  externalId: string;
  title: string | null;
  text: string | null;
  url: string | null;
  author: string | null;
  authorUrl: string | null;
  publishedAt: string | null;
  collectedAt: string;
  query: string;
  engagementJson: string;
  rawJson: string;
  aiStatus: string;
  aiRelevance: number;
  summaryZh: string | null;
  notified: boolean;
  aiAt: string | null;
}

export interface HotspotRow {
  id: number;
  itemId: number | null;
  title: string;
  text: string | null;
  url: string;
  sourceKey: string;
  author: string | null;
  hotScore: number;
  engagementMagnitude: number;
  /** 互动细分原始 JSON（反规范化自 items.engagement_json），API 层解析为对象 */
  engagementJson: string;
  /** AI 判定+相关度理由 JSON（`{"verdict":..,"relevance":..}`）；规则降级/存量无则 null */
  aiReasons: string | null;
  rangeName: string | null;
  aiStatus: string;
  aiRelevance: number;
  summaryZh: string | null;
  publishedAt: string;
  createdAt: string;
}

export interface AlertLogRow {
  id: number;
  keyword: string;
  channel: string;
  title: string | null;
  url: string | null;
  status: string;
  triggeredAt: string;
}