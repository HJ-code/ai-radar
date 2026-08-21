import type { Hotspot } from '../types.ts';

export default function Ticker({ hotspots }: { hotspots: Hotspot[] }) {
  const titles = hotspots.slice(0, 24).map((h) => h.title).filter(Boolean);
  if (!titles.length) {
    return (
      <div className="font-mono2 text-xs text-slate-500">
        等待 AI 热点产出…… <span className="animate-pulse">▮</span>
      </div>
    );
  }
  const row = [...titles, ...titles]; // 复制一份实现无缝循环
  return (
    <div className="ticker-mask overflow-hidden relative">
      <div
        className="ticker-track flex items-center gap-10 whitespace-nowrap w-max"
        style={{ animationDuration: `${Math.max(24, titles.length * 4)}s` }}
      >
        {row.map((t, i) => (
          <span key={i} className="font-mono2 text-xs text-slate-400">
            <span className="text-neon/70 mr-2">▸</span>
            {t}
          </span>
        ))}
      </div>
      {/* 两侧渐变遮罩，模拟整体感 */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-abyss to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-abyss to-transparent" />
    </div>
  );
}