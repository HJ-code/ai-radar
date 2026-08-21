import { useEffect, useMemo, useState } from 'react';
import type { Hotspot } from '../types.ts';
import { AI_STATUS_META, clamp, hash01 } from '../util/time.ts';

interface Blip {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  title: string;
}

const SPAN_MS = 12 * 3600 * 1000; // 雷达扫描半径对应「12 小时内的热点」
const MAX_BLIPS = 24;

function toBlips(hotspots: Hotspot[], nowMs: number): Blip[] {
  const recent = [...hotspots]
    .sort((a, b) => Date.parse(b.createdAt || b.publishedAt) - Date.parse(a.createdAt || a.publishedAt))
    .slice(0, MAX_BLIPS);
  return recent.map((h) => {
    const t = Date.parse(h.createdAt || h.publishedAt);
    const age = nowMs - (Number.isNaN(t) ? nowMs : t);
    const recency = clamp(1 - age / SPAN_MS, 0.08, 1); // 越新越接近 1 → 更靠近圆心
    const r = 9 + recency * 56;                        // 距圆心百分比
    const angle = hash01(h.url || h.title || String(h.id)) * Math.PI * 2;
    const size = clamp(3 + (h.hotScore || 0) / 55, 3, 9);
    return {
      id: h.id,
      x: 50 + r * Math.cos(angle),
      y: 50 + r * Math.sin(angle),
      size,
      color: AI_STATUS_META[h.aiStatus]?.color ?? '#22d3ee',
      title: h.title,
    };
  });
}

export default function Radar({ hotspots, count }: { hotspots: Hotspot[]; count: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const blips = useMemo(() => toBlips(hotspots, now), [hotspots, now]);

  return (
    <div className="relative aspect-square w-full max-w-[430px] mx-auto select-none">
      <div className="absolute inset-0 rounded-full border border-line/70 overflow-hidden grid-bg">
        {/* concentric rings */}
        {[20, 40, 60, 80, 97].map((p) => (
          <div key={p} className="absolute rounded-full border border-line/40" style={{ inset: `${(100 - p) / 2}%` }} />
        ))}
        {/* cross lines */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-line/40" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-line/40" />
        {/* rotating sweep */}
        <div
          className="absolute inset-0 radar-sweep"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(56,232,255,0.34), rgba(56,232,255,0.05) 55deg, transparent 130deg)',
          }}
        />
        {/* outer pulse ring */}
        <div className="absolute inset-0 rounded-full border border-neon/15" style={{ animation: 'pulseBlip 3.4s ease-out infinite' }} />
        {/* blips */}
        {blips.map((b, i) => (
          <div key={b.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
            <span
              className="block rounded-full"
              title={b.title}
              style={{
                width: b.size * 3.2,
                height: b.size * 3.2,
                background: b.color,
                boxShadow: `0 0 12px ${b.color}`,
                animation: 'pulseBlip 3s ease-out infinite',
                animationDelay: `${(i % 5) * 0.5}s`,
              }}
            />
          </div>
        ))}
        {/* center */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <div className="text-[10px] tracking-[0.3em] text-neon/80 uppercase">Trend Radar</div>
          <div className="font-mono2 text-2xl text-neon glow-text">{count ? `${count}` : '···'}</div>
          <div className="text-[10px] text-slate-500">{`${MAX_BLIPS} BLIPS / 12H`}</div>
        </div>
      </div>

      {/* legend */}
      <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 flex gap-4 font-mono2 text-[10px] text-slate-400">
        {(Object.keys(AI_STATUS_META) as (keyof typeof AI_STATUS_META)[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: AI_STATUS_META[k].color, boxShadow: `0 0 6px ${AI_STATUS_META[k].color}` }} />
            {AI_STATUS_META[k].label}
          </span>
        ))}
      </div>
    </div>
  );
}