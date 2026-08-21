import type { Hotspot } from '../types.ts';
import { relTime } from '../util/time.ts';
import AiBadge from './AiBadge.tsx';

export default function HotspotCard({ h, now }: { h: Hotspot; now: number }) {
  const summary = h.summaryZh?.trim();
  const body = summary || h.text;
  return (
    <article className="panel rounded-lg border border-line/60 px-3.5 py-3 flex flex-col gap-1.5 hover:border-neon/30 transition-colors">
      <div className="flex items-center gap-2 flex-wrap">
        <AiBadge status={h.aiStatus} />
        <span className="font-mono2 text-[10px] text-slate-500">{h.sourceKey}</span>
        {h.rangeName && <span className="font-mono2 text-[10px] text-neon/60">{h.rangeName}</span>}
        <span className="ml-auto font-mono2 text-[10px] text-slate-500">{relTime(h.createdAt, now)}</span>
      </div>
      <a
        href={h.url}
        target="_blank"
        rel="noreferrer"
        className="text-sm leading-snug text-slate-100 hover:text-neon transition-colors line-clamp-2"
      >
        {h.title}
      </a>
      {body ? (
        <p className={`text-xs leading-relaxed ${summary ? 'text-slate-300/85' : 'text-slate-500 line-clamp-2'}`}>
          {body.slice(0, 160)}
        </p>
      ) : null}
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-abyss/70 overflow-hidden">
          <div className="h-full rounded-full bg-neon/80" style={{ width: `${Math.max(2, h.aiRelevance || 0)}%` }} />
        </div>
        <span className="font-mono2 text-[10px] text-slate-500">相关 {h.aiRelevance}</span>
        <span className="font-mono2 text-[10px] text-neon">热度 {h.hotScore}</span>
      </div>
    </article>
  );
}