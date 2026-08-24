import type { SourceRow } from '../repositories/types.ts';

export interface ItemDto {
  externalId: string;
  title?: string | null;
  text?: string | null;
  url?: string | null;
  author?: string | null;
  authorUrl?: string | null;
  publishedAt?: string | null;
  engagement?: Record<string, unknown> | null;
  raw?: unknown;
}

export interface Collector {
  sourceKey: string;
  /** 整库型源：一次 search 即返回全部候选，无需按关键词逐个请求 */
  wholeList?: boolean;
  search(query: string, source: SourceRow): Promise<ItemDto[]>;
}