import type { MouseEvent } from 'react';
import type { Hotspot } from '../types.ts';
import { relTime } from '../util/time.ts';
import AiBadge from './AiBadge.tsx';
import { CardSpotlight } from './ui/CardSpotlight.tsx';

interface Props {
  h: Hotspot;
  now: number;
  onShare: (h: Hotspot) => void;
  keywords?: string[];
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HotspotCard({ h, now, onShare, keywords }: Props) {
  const summary = h.summaryZh?.trim();
  // RSS 等资讯型源结构性无互动量，不做“热度”伪装
  const newsType = h.sourceKey === 'rss';
  const isHot = h.hotScore >= 150 && !newsType;
  const hay = `${h.title ?? ''}\n${h.text ?? ''}\n${h.url ?? ''}`.toLowerCase();
  // 优先用服务端给出的命中启用关键词；老数据兜底走客户端子串匹配
  const hits = (keywords ?? []).filter((k) => k && hay.includes(k.toLowerCase())).slice(0, 3);
  const kw = (h.keywords && h.keywords.length ? h.keywords : hits).slice(0, 3);

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  return (
    <CardSpotlight radius={220} color={h.aiStatus === 'real' ? '#34d399' : '#38e8ff'} className="rounded-2xl">
      <article className="glass rounded-2xl px-4 py-3 flex flex-col gap-1.5 h-full hover:border-neon/30 transition-colors">
        <div className="flex items-center gap-2">
          <AiBadge status={h.aiStatus} />
          <span className="hud-label text-[9px] text-slate-500">{h.sourceKey}</span>
          {newsType && (
            <span className="font-mono2 text-[9px] text-slate-400 border border-slate-500/30 bg-slate-500/10 rounded px-1 py-px">
              资讯
            </span>
          )}
          {isHot && (
            <span className="font-mono2 text-[9px] text-warn border border-warn/40 rounded px-1 py-px bg-warn/10 animate-pulse">
              HOT 【{h.hotScore}】
            </span>
          )}
          <span className="ml-auto font-mono2 text-[10px] text-slate-500">{relTime(h.createdAt, now)}</span>
        </div>

        {/* 命中的监控配置点：监控范围 + 追踪关键词 */}
        {(h.rangeName || kw.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {h.rangeName && (
              <span className="font-mono2 text-[9px] text-neon/80 border border-neon/25 bg-neon/5 rounded px-1.5 py-px">
                范围 · {h.rangeName}
              </span>
            )}
            {kw.map((k) => (
              <span key={k} className="font-mono2 text-[9px] text-signal border border-signal/30 bg-signal/5 rounded px-1.5 py-px">
                关键词 · {k}
              </span>
            ))}
          </div>
        )}

        <a
          href={h.url}
          target="_blank"
          rel="noreferrer"
          onClick={stop}
          className="text-[13.5px] leading-snug text-slate-100 hover:text-neon transition-colors font-medium flex items-start gap-1"
        >
          {h.title}
          <ExternalIcon />
        </a>

        {summary ? (
          <p className="text-xs text-slate-300/85 leading-relaxed">{summary}</p>
        ) : h.text ? (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{h.text}</p>
        ) : null}

        <div className="mt-1 flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, h.aiRelevance || 0)}%`,
                background: 'linear-gradient(90deg,#34d399,#38e8ff)',
              }}
            />
          </div>
          <span className="font-mono2 text-[10px] text-slate-500">
            {h.author ? `${h.author.slice(0, 16)} · ` : ''}相关 {h.aiRelevance}
          </span>
          <button
            onClick={(e) => {
              stop(e);
              onShare(h);
            }}
            title="复制标题+链接，第一时间分享"
            aria-label="复制分享"
            className="hud-label text-[9px] text-slate-500 hover:text-neon flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer transition-colors"
          >
            <CopyIcon /> 分享
          </button>
        </div>
      </article>
    </CardSpotlight>
  );
}