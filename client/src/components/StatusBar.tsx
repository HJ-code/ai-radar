import type { AiSystem, Health } from '../types.ts';

interface Props {
  health: Health | null;
  ai: AiSystem | null;
  now: number;
  collecting: boolean;
  onCollect: () => void;
  lastError?: string | null;
  unread: number;
  onBell: () => void;
  bellTitle: string;
}

function Bell({ unread }: { unread: number }) {
  return (
    <span className="relative inline-flex items-center justify-center w-5 h-5 text-slate-300">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-0.5 rounded-full bg-danger text-white text-[9px] leading-[15px] text-center font-mono2">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </span>
  );
}

export default function StatusBar({ health, ai, now, collecting, onCollect, lastError, unread, onBell, bellTitle }: Props) {
  const online = Boolean(health?.dbConnected);
  const clock = new Date(now).toLocaleTimeString('zh-CN', { hour12: false });
  const aiMode = ai
    ? ai.configured
      ? { label: 'AI 在线', cls: 'text-signal border-signal/40 bg-signal/10' }
      : { label: '降级模式', cls: 'text-warn border-warn/40 bg-warn/10' }
    : null;

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-abyss/70 backdrop-blur">
      <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full shadow-[0_0_12px_currentColor] ${online ? 'bg-signal text-signal animate-pulse' : 'bg-danger text-danger'}`} />
          <h1 className="font-mono2 text-sm tracking-[0.22em] text-neon glow-text">AI 热点雷达</h1>
          <span className="hidden md:inline text-[11px] text-slate-500 tracking-widest">MULTI-SOURCE TREND RADAR</span>
        </div>

        <div className="flex items-center gap-3 ml-auto font-mono2 text-xs flex-wrap">
          {lastError && <span className="hidden lg:inline text-danger/80 max-w-[240px] truncate" title={lastError}>{lastError}</span>}
          {aiMode && (
            <span className={`px-2 py-0.5 rounded border text-[10px] ${aiMode.cls}`}>{aiMode.label}</span>
          )}
          <button
            onClick={onBell}
            title={bellTitle}
            aria-label="浏览器通知"
            className="relative hover:text-neon transition-colors"
          >
            <Bell unread={unread} />
          </button>
          <span className={`${online ? 'text-signal' : 'text-danger'} tracking-wider`}>
            {online ? '● ONLINE' : '○ OFFLINE'}
          </span>
          <span className="text-slate-400">{clock}</span>
          <button
            onClick={onCollect}
            disabled={collecting || !online}
            className="px-3 py-1 rounded-md border border-neon/40 text-neon text-[11px] tracking-wider hover:bg-neon/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {collecting ? '采集中…' : '⟳ 立即采集'}
          </button>
        </div>
      </div>
    </header>
  );
}