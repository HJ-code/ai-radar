import type { AiSystem, Health } from '../types.ts';
import { MagicButton } from './ui/MagicButton.tsx';

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
    <span className="relative inline-flex items-center justify-center w-6 h-6 text-slate-300">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-0.5 rounded-full bg-danger text-white text-[10px] leading-[16px] text-center font-mono2 shadow-[0_0_8px_#fb7185]">
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
    ? ai.enabled
      ? ai.configured
        ? { label: 'AI 在线', cls: 'text-signal bg-signal/10 border-signal/30' }
        : { label: '降级模式', cls: 'text-warn bg-warn/10 border-warn/30' }
      : { label: 'AI 已停用', cls: 'text-slate-400 bg-white/5 border-white/15' }
    : null;

  return (
    <header className="sticky top-0 z-20">
      <div className="border-b border-white/10 bg-abyss/45 backdrop-blur-2xl">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center gap-3 flex-wrap">
          {/* 品牌 + LIVE */}
          <div className="flex items-center gap-2.5">
            <span
              className={`relative flex w-2.5 h-2.5 rounded-full ${
                online ? 'bg-signal shadow-[0_0_10px_#34d399]' : 'bg-danger shadow-[0_0_10px_#fb7185]'
              }`}
            >
              {online && <span className="absolute inset-0 rounded-full animate-ping bg-signal/60" />}
            </span>
            <h1 className="hud-display text-sm grad-text tracking-[0.22em]">AI 热点雷达</h1>
            <span className="hidden md:inline hud-label text-[10px] text-slate-500">MULTI-SOURCE RADAR</span>
          </div>

          <div className="flex items-center gap-3 ml-auto flex-wrap">
            {lastError && (
              <span className="hidden lg:inline text-danger/80 max-w-[220px] truncate font-mono2 text-xs" title={lastError}>
                {lastError}
              </span>
            )}
            {aiMode && (
              <span className={`px-2 py-0.5 rounded-full border font-mono2 text-[10px] ${aiMode.cls}`}>{aiMode.label}</span>
            )}
            <button onClick={onBell} title={bellTitle} aria-label="浏览器通知" className="hover:text-neon transition-colors cursor-pointer">
              <Bell unread={unread} />
            </button>
            <span className={`font-mono2 text-xs tracking-wider ${online ? 'text-signal' : 'text-danger'}`}>{online ? '● LIVE' : '○ OFFLINE'}</span>
            <span className="font-mono2 text-xs text-slate-400 tabular-nums">{clock}</span>
            <MagicButton
              onClick={onCollect}
              disabled={collecting || !online}
              expanding="RUN NOW"
              className="h-9 px-5 disabled:opacity-40"
            >
              {collecting ? '采集中…' : '⟳ 立即采集'}
            </MagicButton>
          </div>
        </div>
      </div>
    </header>
  );
}