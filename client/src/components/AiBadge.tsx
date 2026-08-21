import type { AiStatus } from '../types.ts';
import { AI_STATUS_META } from '../util/time.ts';

export default function AiBadge({ status, size = 'sm' }: { status: AiStatus; size?: 'sm' | 'md' }) {
  const meta = AI_STATUS_META[status] ?? AI_STATUS_META.unscored;
  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded font-mono2 ${
        size === 'md' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-px text-[10px]'
      } ${meta.badge}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
      {meta.label}
    </span>
  );
}