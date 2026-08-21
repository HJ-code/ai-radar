import type { AiStatus } from '../types.ts';

/** ISO 时间 → 中文相对时间（秒/分/时/天） */
export function relTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const diff = Math.max(0, now - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(t).toLocaleDateString('zh-CN');
}

export const AI_STATUS_META: Record<AiStatus, { label: string; color: string; badge: string }> = {
  real: { label: '真实', color: '#34d399', badge: 'bg-signal/15 text-signal border-signal/40' },
  doubtful: { label: '存疑', color: '#fbbf24', badge: 'bg-warn/15 text-warn border-warn/40' },
  fake: { label: '虚假', color: '#fb7185', badge: 'bg-danger/15 text-danger border-danger/40' },
  unscored: { label: '未鉴定', color: '#22d3ee', badge: 'bg-cyan/10 text-cyan border-cyan/30' },
};

/** 稳定散列（字符串 → 0..1），用于雷达落点角度定位 */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}