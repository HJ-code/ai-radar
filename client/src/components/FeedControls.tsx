import { useEffect, useRef, useState } from 'react';
import type { AiStatus, HotspotSortKey, HotspotView, Range, Source } from '../types.ts';
import { cn } from '../lib/utils.ts';

const SORT_OPTIONS: { key: HotspotSortKey; label: string }[] = [
  { key: 'smart', label: '智能热度' },
  { key: 'published', label: '最新发布' },
  { key: 'collected', label: '刚入库' },
  { key: 'hot', label: '最热' },
  { key: 'engagement', label: '互动最多' },
  { key: 'relevance', label: '最相关' },
];

const STATUS_OPTIONS: { key: AiStatus; label: string }[] = [
  { key: 'real', label: '真实' },
  { key: 'doubtful', label: '存疑' },
  { key: 'unscored', label: '未鉴定' },
];

const WINDOW_OPTIONS: { label: string; min: number | null }[] = [
  { label: '全部', min: null },
  { label: '24小时', min: 1440 },
  { label: '3天', min: 4320 },
  { label: '7天', min: 10080 },
];

const THRESHOLDS = ['60', '70', '80', '90'];

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);
  return ref;
}

function toggleInList<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

interface Props {
  view: HotspotView;
  onChange: (patch: Partial<HotspotView>) => void;
  onClear: () => void;
  sources: Source[];
  ranges: Range[];
  total: number | null;
  loaded: number;
}

/** 排序 + 筛选控制条：排序下拉 / 升降序 / 筛选药丸(弹层多选) / 搜索 / 清除 / 计数 */
export default function FeedControls({ view, onChange, onClear, sources, ranges, total, loaded }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [qDraft, setQDraft] = useState(view.q);
  const qDebounce = useRef<number | undefined>(undefined);
  const rootRef = useClickOutside(() => setOpenMenu(null));

  useEffect(() => {
    setQDraft(view.q);
  }, [view.q]);

  function setQ(v: string) {
    setQDraft(v);
    window.clearTimeout(qDebounce.current);
    qDebounce.current = window.setTimeout(() => onChange({ q: v }), 350);
  }

  const activeCount =
    (view.sources.length > 0 ? 1 : 0) +
    (view.range ? 1 : 0) +
    (view.statuses.length > 0 ? 1 : 0) +
    (view.windowMin != null ? 1 : 0) +
    (view.type ? 1 : 0) +
    (view.relevanceMin != null ? 1 : 0) +
    (view.scoreMin != null ? 1 : 0) +
    (view.q.trim() ? 1 : 0);

  const popover = (key: string): React.ReactNode => {
    const row = (label: string, active: boolean, onClick: () => void, noCheck?: boolean) => (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-left text-[11px] cursor-pointer transition-colors',
          active ? 'bg-neon/10 text-neon' : 'text-slate-300 hover:bg-white/5 hover:text-neon',
        )}
      >
        {!noCheck && (
          <span className={cn('w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] shrink-0', active ? 'border-neon/60 bg-neon/20 text-neon' : 'border-slate-600')}>
            {active ? '✓' : ''}
          </span>
        )}
        {label}
      </button>
    );

    switch (key) {
      case 'source':
        return (
          <div className="max-h-[240px] overflow-y-auto space-y-0.5">
            {sources.length === 0 && <div className="text-slate-600 px-2 py-1">加载中…</div>}
            {sources.map((s) => row(s.displayName, view.sources.includes(s.sourceKey), () => onChange({ sources: toggleInList(view.sources, s.sourceKey) })))}
          </div>
        );
      case 'range':
        return (
          <div className="max-h-[200px] overflow-y-auto space-y-0.5">
            {ranges.length === 0 && <div className="text-slate-600 px-2 py-1">暂无范围</div>}
            {row('全部', view.range === null, () => onChange({ range: null }))}
            {ranges.map((r) => row(r.name, view.range === r.name, () => onChange({ range: view.range === r.name ? null : r.name })))}
          </div>
        );
      case 'status':
        return (
          <div className="space-y-0.5">
            {STATUS_OPTIONS.map((s) => row(s.label, view.statuses.includes(s.key), () => onChange({ statuses: toggleInList(view.statuses, s.key) })))}
          </div>
        );
      case 'window':
        return (
          <div className="space-y-0.5">
            {WINDOW_OPTIONS.map((w) => row(w.label, view.windowMin === w.min, () => onChange({ windowMin: w.min })))}
          </div>
        );
      case 'type':
        return (
          <div className="space-y-0.5">
            {row('资讯', view.type === 'news', () => onChange({ type: view.type === 'news' ? null : 'news' }))}
            {row('互动', view.type === 'interactive', () => onChange({ type: view.type === 'interactive' ? null : 'interactive' }))}
          </div>
        );
      case 'relevance':
      case 'score': {
        const cur = key === 'relevance' ? view.relevanceMin : view.scoreMin;
        const set = (k: 'relevanceMin' | 'scoreMin', v: number | null) => onChange({ [k]: v } as Partial<HotspotView>);
        return (
          <div className="p-1.5 space-y-1.5">
            <div className="flex gap-1.5">
              {THRESHOLDS.map((v) => {
                const n = Number(v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set(key === 'relevance' ? 'relevanceMin' : 'scoreMin', cur === n ? null : n)}
                    className={cn('px-1.5 py-0.5 rounded border cursor-pointer transition-colors', cur === n ? 'border-neon/60 text-neon bg-neon/5' : 'border-slate-700 text-slate-400 hover:border-slate-500')}
                  >
                    {v}+
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-500">{key === 'relevance' ? 'AI 相关度 ≥' : '热力值 ≥'}</div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const popoverActive = (key: string): boolean => {
    switch (key) {
      case 'source': return view.sources.length > 0;
      case 'range': return !!view.range;
      case 'status': return view.statuses.length > 0;
      case 'window': return view.windowMin != null;
      case 'type': return !!view.type;
      case 'relevance': return view.relevanceMin != null;
      case 'score': return view.scoreMin != null;
      default: return false;
    }
  };

  const FILTERS: { key: string; label: string }[] = [
    { key: 'source', label: '来源' },
    { key: 'range', label: '范围' },
    { key: 'status', label: '真伪' },
    { key: 'window', label: '时间' },
    { key: 'type', label: '类型' },
    { key: 'relevance', label: '相关度' },
    { key: 'score', label: '热力' },
  ];

  return (
    <div ref={rootRef} className="flex flex-wrap items-center gap-1.5">
      {/* 排序下拉 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] pl-2.5 pr-2 py-1 font-mono2 text-[11px] text-neon cursor-pointer hover:border-neon/45"
        >
          排序·{SORT_OPTIONS.find((s) => s.key === view.sort)?.label ?? view.sort}
          <svg className={cn('h-3 w-3 text-neon/70 transition-transform', openMenu === 'sort' && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {openMenu === 'sort' && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-40 min-w-[128px] rounded-lg border border-white/12 bg-panel2/95 p-1 shadow-[0_10px_28px_rgba(0,0,0,0.55)]">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => { onChange({ sort: s.key }); setOpenMenu(null); }}
                className={cn('block w-full rounded-md px-2.5 py-1.5 text-left font-mono2 text-[11px] cursor-pointer transition-colors', view.sort === s.key ? 'bg-neon/10 text-neon' : 'text-slate-300 hover:bg-white/5 hover:text-neon')}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 升降序 */}
      <button
        type="button"
        onClick={() => onChange({ order: view.order === 'desc' ? 'asc' : 'desc' })}
        title={view.order === 'desc' ? '切换为升序' : '切换为降序'}
        className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 font-mono2 text-[11px] text-slate-300 cursor-pointer hover:border-neon/45"
      >
        {view.order === 'desc' ? '↓ 降' : '↑ 升'}
      </button>

      {/* 筛选药丸 + 各自弹层 */}
      {FILTERS.map((pill) => {
        const active = popoverActive(pill.key);
        return (
          <div key={pill.key} className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === pill.key ? null : pill.key)}
              className={cn(
                'flex items-center gap-1 rounded-lg border px-2 py-1 font-mono2 text-[11px] cursor-pointer transition-colors',
                active ? 'border-neon/50 text-neon bg-neon/5' : 'border-white/10 text-slate-400 hover:border-slate-500 hover:text-slate-200',
              )}
            >
              {pill.label}
              {active && <span className="w-1.5 h-1.5 rounded-full bg-neon" />}
            </button>
            {openMenu === pill.key && (
              <div className="absolute left-0 top-[calc(100%+4px)] z-40 min-w-[150px] rounded-lg border border-white/12 bg-panel2/95 p-1 shadow-[0_10px_28px_rgba(0,0,0,0.55)]">
                {popover(pill.key)}
              </div>
            )}
          </div>
        );
      })}

      {/* 搜索 */}
      <input
        value={qDraft}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索标题/正文…"
        className="min-w-[120px] flex-1 max-w-[200px] rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-neon/50"
      />

      {activeCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-warn/40 px-2 py-1 font-mono2 text-[11px] text-warn cursor-pointer hover:bg-warn/10"
        >
          清除（{activeCount}）
        </button>
      )}

      <span className="ml-auto font-mono2 text-[11px] text-slate-500 whitespace-nowrap">
        已加载 {loaded}{total != null ? ` · 共 ${total}` : ''}
      </span>
    </div>
  );
}