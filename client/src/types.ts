export type AiStatus = 'real' | 'doubtful' | 'fake' | 'unscored';

export interface Health {
  status: string;
  time: string;
  dbConnected: boolean;
  version: string;
}

export interface Stats {
  items: number;
  hotspots: number;
  keywords: number;
  keywordEnabled: number;
  alerts: number;
  lastCollect: string | null;
  lastHotspot: string | null;
}

export interface Source {
  id: number;
  sourceKey: string;
  displayName: string;
  enabled: boolean;
  apiKey: string | null;
  intervalMinutes: number;
  lastRunAt: string | null;
  extraJson: string;
}

export interface Keyword {
  id: number;
  keyword: string;
  note: string;
  enabled: boolean;
  createdAt: string;
  lastTriggeredAt: string | null;
  triggerCount: number;
  lastHotspotId: number | null;
}

export interface Range {
  id: number;
  name: string;
  description: string;
  queriesCsv: string;
  enabled: boolean;
  createdAt: string;
}

export interface Hotspot {
  id: number;
  itemId: number | null;
  title: string;
  text: string | null;
  url: string;
  sourceKey: string;
  author: string | null;
  hotScore: number;
  rangeName: string | null;
  aiStatus: AiStatus;
  aiRelevance: number;
  summaryZh: string | null;
  publishedAt: string;
  createdAt: string;
}

export interface AiSystem {
  configured: boolean;
  baseUrl: string;
  model: string;
  apiKeyPresent: boolean;
  minRelevance: number;
  maxPerRun: number;
  timeoutMs: number;
  cooldownMs: number;
  failStreak: number;
}

export interface CollectResult {
  added: number;
  scanned: number;
  aiProcessed: number;
  errors: string[];
  ranAt: string;
}

export interface AlertLog {
  id: number;
  keyword: string;
  channel: string;
  title: string | null;
  url: string | null;
  status: string;
  triggeredAt: string;
}

/** SSE `alert` 事件载荷（后端 inapp 广播体） */
export interface SseAlert {
  keyword: string;
  title: string | null;
  url: string | null;
  sourceKey: string;
  aiStatus: AiStatus;
  relevance: number;
  summaryZh: string | null;
  hotspotId: number;
  at: string;
}

export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';