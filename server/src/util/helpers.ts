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