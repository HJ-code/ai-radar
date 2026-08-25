import type { SourceRow } from '../repositories/types.ts';

export function getExtra(src: SourceRow): Record<string, unknown> {
  try {
    const parsed = JSON.parse(src.extraJson ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function cleanWs(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.replace(/\s+/g, ' ').trim();
}

export function firstEntry<T>(value: T | T[] | undefined | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function toIsoOrNull(input: string | number | Date | null | undefined): string | null {
  if (input == null) return null;
  if (typeof input === 'number') return new Date(input * 1000).toISOString();
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** 从 engagement 原始 JSON 提取一个总互动量级数字（取各源已知数字字段的最大值，用于互动排序/热力展示） */
export function engagementMagnitude(engagementJson: string): number {
  let obj: unknown;
  try { obj = JSON.parse(engagementJson || '{}'); } catch { return 0; }
  if (!obj || typeof obj !== 'object') return 0;
  const numericKeys = ['points', 'score', 'stars', 'downloads', 'likes', 'comments', 'num_comments', 'forks', 'ups'];
  let max = 0;
  for (const entry of Object.entries(obj as Record<string, unknown>)) {
    const [k, v] = entry;
    if (numericKeys.includes(k) && typeof v === 'number' && Number.isFinite(v)) {
      max = Math.max(max, v);
    }
  }
  return max;
}