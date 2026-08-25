import { useState, type MouseEvent } from 'react';
import type { Hotspot } from '../types.ts';
import { relTime } from '../util/time.ts';
import { fmtCount, SOURCE_ENGAGEMENT_LABELS } from '../util/engagement.ts';
import AiBadge from './AiBadge.tsx';
import { CardSpotlight } from './ui/CardSpotlight.tsx';

interface Props {
  h: Hotspot;
  now: number;
  onShare: (h: Hotspot) => void;
  keywords?: string[];
  onTagClick?: (kind: 'source' | 'range' | 'keyword', value: string) => void;
  /** AI 依据折叠区展开状态（由父组件批量控制） */
  reasonOpen?: boolean;
  onReasonToggle?: () => void;
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

export default function HotspotCard({ h, now, onShare, keywords, onTagClick, reasonOpen, onReasonToggle }: Props) {
  const [showRaw, setShowRaw] = useState(false);
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

  // 互动细分徽章：仅展示该源存在的非零字段（资讯型不伪造热度）
  const engagementChips: { label: string; value: number }[] = [];
  const labelMap = SOURCE_ENGAGEMENT_LABELS[h.sourceKey];
  if (labelMap && h.engagement) {
    for (const [k, label] of Object.entries(labelMap)) {
      const v = h.engagement[k];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        engagementChips.push({ label, value: v });
      }
    }
  }

  // 新鲜度：抓取时间相对发布时间的滞后（越小越抢到第一手；发布≈抓取时不算）
  let freshness: { text: string; fresh: boolean } | null = null;
  const publishedMs = Date.parse(h.publishedAt);
  const createdMs = Date.parse(h.createdAt);
  if (createdMs && publishedMs && createdMs - publishedMs >= 60_000) {
    const lagMin = Math.round((createdMs - publishedMs) / 60_000);
    if (lagMin < 60) freshness = { text: `发布后 ${lagMin} 分钟`, fresh: true };
    else if (lagMin < 1440) freshness = { text: `发布后 ${Math.round(lagMin / 60)} 小时`, fresh: false };
    else freshness = { text: `发布后 ${Math.round(lagMin / 1440)} 天`, fresh: false };
  }

  const tagCls =
    'font-mono2 text-[9px] rounded px-1.5 py-px cursor-pointer transition-colors hover:brightness-125';

  return (
    <CardSpotlight radius={220} color={h.aiStatus === 'real' ? '#34d399' : '#38e8ff'} className="rounded-2xl">
      <article className="glass rounded-2xl px-4 py-3 flex flex-col gap-1.5 h-full hover:border-neon/30 transition-colors">
        <div className="flex items-center gap-2">
          <AiBadge status={h.aiStatus} />
          {onTagClick ? (
            <button
              onClick={(e) => { stop(e); onTagClick('source', h.sourceKey); }}
              title="点击按此来源筛选"
              className="hud-label text-[9px] text-slate-500 hover:text-neon cursor-pointer"
            >
              {h.sourceKey}
            </button>
          ) : (
            <span className="hud-label text-[9px] text-slate-500">{h.sourceKey}</span>
          )}
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
          <span className="ml-auto font-mono2 text-[10px] text-slate-500">发布 {relTime(h.publishedAt, now)}</span>
        </div>

        {/* 时间/互动元信息：抓取时间 + 新鲜度 + 按来源细分的互动徽章 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono2 text-[9px] text-slate-500">
          {engagementChips.map((c) => (
            <span key={c.label} className="text-slate-400" title={`${c.label} ${c.value}`}>
              {c.label} {fmtCount(c.value)}
            </span>
          ))}
          {engagementChips.length > 0 && <span className="text-slate-600">/</span>}
          <span>抓取 {relTime(h.createdAt, now)}</span>
          {freshness && (
            <span
              className={freshness.fresh ? 'text-signal' : 'text-slate-500'}
              title="抓取相对发布时间的滞后（越小越抢到第一手）"
            >
              {freshness.text}
            </span>
          )}
        </div>

        {/* 命中的监控配置点：监控范围 + 追踪关键词（可点击筛选） */}
        {(h.rangeName || kw.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {h.rangeName && (
              <button
                type="button"
                disabled={!onTagClick}
                onClick={(e) => { stop(e); onTagClick?.('range', h.rangeName!); }}
                className={`${tagCls} border border-neon/25 bg-neon/5 text-neon/80 ${onTagClick ? 'cursor-pointer' : 'cursor-default'}`}
                title={onTagClick ? '点击按此范围筛选' : undefined}
              >
                范围 · {h.rangeName}
              </button>
            )}
            {kw.map((k) => (
              <button
                key={k}
                type="button"
                disabled={!onTagClick}
                onClick={(e) => { stop(e); onTagClick?.('keyword', k); }}
                className={`${tagCls} border border-signal/30 bg-signal/5 text-signal ${onTagClick ? 'cursor-pointer' : 'cursor-default'}`}
                title={onTagClick ? '点击搜索关键词' : undefined}
              >
                关键词 · {k}
              </button>
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
          <div className="space-y-1">
            <p className="text-xs text-slate-300/85 leading-relaxed">
              <span className="align-middle mr-1 font-mono2 text-[8px] text-neon/70 border border-neon/25 rounded px-1 py-px">
                AI 摘要
              </span>
              <span className="align-middle">{summary}</span>
              {h.text && (
                <button
                  onClick={(e) => { stop(e); setShowRaw((s) => !s); }}
                  title={showRaw ? '收起原始描述' : '展开原始描述查看'}
                  className="ml-1.5 align-middle font-mono2 text-[9px] text-slate-500 hover:text-neon px-1 py-0.5 rounded transition-colors"
                >
                  {showRaw ? '原文 ▾' : '原文 ▸'}
                </button>
              )}
            </p>
            {showRaw && h.text && (
              <p className="text-xs text-slate-500 leading-relaxed border-l border-white/10 pl-2 whitespace-pre-wrap">
                {h.text}
              </p>
            )}
          </div>
        ) : h.text ? (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
            <span className="mr-1 font-mono2 text-[8px] text-slate-500 border border-white/10 rounded px-1 py-px">原文</span>
            {h.text}
          </p>
        ) : null}

        {/* AI 依据：判定理由 + 相关度理由（折叠展示，父组件可批量展开全部） */}
        {h.aiReasons && (h.aiReasons.verdict || h.aiReasons.relevance) && (
          <div>
            <button
              onClick={(e) => { stop(e); onReasonToggle?.(); }}
              title={reasonOpen ? '折叠本卡 AI 依据' : '展开本卡 AI 依据'}
              className="flex items-center gap-1 font-mono2 text-[9px] text-slate-500 hover:text-neon transition-colors"
            >
              <span className="text-[8px]">{reasonOpen ? '▾' : '▸'}</span>
              <span className="border border-white/10 bg-white/5 rounded px-1 py-px">AI 依据</span>
              <span className="text-slate-600">{reasonOpen ? '折叠' : '展开'}</span>
            </button>
            {reasonOpen && (
              <div className="mt-1 space-y-1 text-[10px] text-slate-400 leading-relaxed rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5">
                {h.aiReasons.verdict && (
                  <p><span className="text-slate-500">判定 · </span>{h.aiReasons.verdict}</p>
                )}
                {h.aiReasons.relevance && (
                  <p><span className="text-slate-500">相关 · </span>{h.aiReasons.relevance}</p>
                )}
              </div>
            )}
          </div>
        )}

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