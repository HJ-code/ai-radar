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
  search(query: string, source: SourceRow): Promise<ItemDto[]>;
}