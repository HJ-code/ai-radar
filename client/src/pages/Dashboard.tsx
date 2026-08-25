import { memo, useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import type { Hotspot, HotspotView, Range, Source } from '../types.ts';
import { getAiSystem, getAlerts, getKeywords, getStats, setAiEnabled, testAi, testNotify, updateSource } from '../api/client.ts';
import { usePoll } from '../hooks/usePoll.ts';
import { relTime } from '../util/time.ts';
import Radar from '../components/Radar.tsx';
import HotspotCard from '../components/HotspotCard.tsx';
import Toggle from '../components/Toggle.tsx';
import FeedControls from '../components/FeedControls.tsx';
import { BorderBeam } from '../components/ui/BorderBeam.tsx';
import { FieldSelect } from '../components/ui/FieldSelect.tsx';
import { GlareCard } from '../components/ui/GlareCard.tsx';
import { Reveal } from '../components/ui/Reveal.tsx';

function parseExtra(json: string): Record<string, unknown> {
  try {
    const o = JSON.parse(json || '{}') as unknown;
    return o && typeof o === 'object' ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** 冷却秒级倒计时：endAt = 冷却结束的绝对时间戳（稳定），本地 1s tick 连续递减，只重渲自身。
 *  注意：不要把 Date.now()+剩余 当 prop 传入——Dashboard 重渲会让它每次变，effect 反复重置导致跳秒。 */
function AiCooldown({ endAt }: { endAt: number }) {
  const [leftMs, setLeftMs] = useState(0);
  useEffect(() => {
    const tick = () => setLeftMs(Math.max(0, endAt - Date.now()));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [endAt]);
  if (leftMs <= 0) return <span className="text-signal">可处理</span>;
  return <span className="text-warn">冷却 {Math.ceil(leftMs / 1000)}s 后自动处理</span>;
}

/** 数据源行内配置编辑器：rss 编辑 feed 列表，github 调最低 Stars，bilibili 调分区 */
function SourceConfigEditor({ s, onSaved, onNotice }: { s: Source; onSaved: () => void; onNotice: (m: string) => void }) {
  const [initial] = useState(() => parseExtra(s.extraJson) as { feeds?: unknown[]; minStars?: number; searchKeywords?: unknown[]; searchThrottleMs?: number; searchLimit?: number; limit?: number });
  const [feedsText, setFeedsText] = useState(() => (Array.isArray(initial.feeds) ? (initial.feeds as unknown[]).join('\n') : ''));
  const [minStars, setMinStars] = useState(() => (initial.minStars != null ? String(initial.minStars) : ''));
  const [searchKwText, setSearchKwText] = useState(() => (Array.isArray(initial.searchKeywords) ? (initial.searchKeywords as unknown[]).join(', ') : ''));
  const [throttleSec, setThrottleSec] = useState(() => (initial.searchThrottleMs != null ? String(Math.round(initial.searchThrottleMs / 1000)) : ''));
  const [limit, setLimit] = useState(() => (initial.limit != null ? String(initial.limit) : initial.searchLimit != null ? String(initial.searchLimit) : ''));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const extra = parseExtra(s.extraJson);
      if (s.sourceKey === 'rss') {
        extra.feeds = feedsText.split('\n').map((f) => f.trim()).filter(Boolean);
      } else if (s.sourceKey === 'github') {
        if (minStars.trim() !== '') extra.minStars = Number(minStars);
        if (limit.trim() !== '') extra.limit = Number(limit);
      } else if (s.sourceKey === 'bilibili') {
        if (searchKwText.trim() !== '') {
          const kws = searchKwText.split(/[,，\n]+/).map((t) => t.trim()).filter(Boolean);
          if (kws.length > 0) extra.searchKeywords = kws;
        }
        if (throttleSec.trim() !== '') extra.searchThrottleMs = Math.max(0, Math.round(Number(throttleSec) * 1000));
        if (limit.trim() !== '') extra.searchLimit = Number(limit);
      }
      await updateSource(s.id, { extraJson: JSON.stringify(extra) });
      onNotice(`${s.displayName} 配置已保存`);
      onSaved();
    } catch (e) {
      onNotice(`保存失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-lg p-3 mt-1 space-y-2">
      {s.sourceKey === 'rss' && (
        <>
          <div className="font-mono2 text-[10px] text-slate-400">RSS feed 列表（一行一个）</div>
          <textarea
            value={feedsText}
            onChange={(e) => setFeedsText(e.target.value)}
            rows={Math.max(3, Math.min(7, feedsText.split('\n').length + 1))}
            className="w-full bg-abyss/60 border border-slate-700 rounded-md px-2 py-1.5 text-[11px] text-slate-200 font-mono2 focus:outline-none focus:border-neon/50 resize-y"
          />
        </>
      )}
      {s.sourceKey === 'github' && (
        <div className="flex gap-3 text-[11px]">
          <label className="flex items-center gap-1.5 text-slate-400">
            最低 Stars
            <input value={minStars} onChange={(e) => setMinStars(e.target.value.replace(/\D/g, ''))} placeholder="500" className="w-20 bg-abyss/60 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono2 focus:outline-none focus:border-neon/50" />
          </label>
          <label className="flex items-center gap-1.5 text-slate-400">
            条数
            <input value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} placeholder="10" className="w-16 bg-abyss/60 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono2 focus:outline-none focus:border-neon/50" />
          </label>
        </div>
      )}
      {s.sourceKey === 'bilibili' && (
        <div className="space-y-2 text-[11px]">
          <label className="block text-slate-400">
            搜索词（逗号分隔）
            <input value={searchKwText} onChange={(e) => setSearchKwText(e.target.value)} placeholder="GPT,Claude,DeepSeek,大模型" className="mt-1 w-full bg-abyss/60 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono2 focus:outline-none focus:border-neon/50" />
          </label>
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-slate-400">
              节流(秒)
              <input value={throttleSec} onChange={(e) => setThrottleSec(e.target.value.replace(/\D/g, ''))} placeholder="6" className="w-14 bg-abyss/60 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono2 focus:outline-none focus:border-neon/50" />
            </label>
            <label className="flex items-center gap-1.5 text-slate-400">
              每词条数
              <input value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} placeholder="10" className="w-16 bg-abyss/60 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono2 focus:outline-none focus:border-neon/50" />
            </label>
          </div>
        </div>
      )}
      {!['rss', 'github', 'bilibili'].includes(s.sourceKey) && (
        <div className="text-[10px] text-slate-500">该源暂无可编辑配置（可调开关与间隔）</div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={busy} className="px-3 py-1 rounded-md glass text-neon text-[11px] tracking-wider hover:border-neon/40 disabled:opacity-40 cursor-pointer transition-colors">
          {busy ? '保存中…' : '保存'}
        </button>
        <button onClick={onSaved} className="px-3 py-1 rounded-md text-slate-400 text-[11px] hover:text-slate-200 cursor-pointer transition-colors">
          取消
        </button>
      </div>
    </div>
  );
}

interface SourceRowProps {
  id: number;
  displayName: string;
  sourceKey: string;
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  /** 原始 extra_json（编辑器用） */
  extraJson: string;
  busy: boolean;
  onToggle: (id: number, name: string, v: boolean) => void;
  onInterval: (id: number, name: string, m: number) => void;
  onNotice: (m: string) => void;
}

/** 数据源行：标量 props + memo，轮询/整页重渲时只有变化的行才重建；busy 期间禁点并降透明度 */
const SourceRow = memo(function SourceRow({ id, displayName, sourceKey, enabled, intervalMinutes, lastRunAt, extraJson, busy, onToggle, onInterval, onNotice }: SourceRowProps) {
  const [configuring, setConfiguring] = useState(false);
  const s: Source = useMemo(
    () => ({ id, displayName, sourceKey, enabled, intervalMinutes, lastRunAt, apiKey: null, extraJson }),
    [id, displayName, sourceKey, enabled, intervalMinutes, lastRunAt, extraJson],
  );
  return (
    <div className={`space-y-1${busy ? ' pointer-events-none opacity-70' : ''}`}>
      <div className="glass rounded-lg px-3 py-1.5 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-200 truncate">{displayName}</div>
          <div className="font-mono2 text-[10px] text-slate-500 truncate">
            {sourceKey} · {lastRunAt ? `上次 ${relTime(lastRunAt)}` : '未运行'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfiguring((c) => !c)}
          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
            configuring ? 'border-neon/50 text-neon' : 'border-slate-600/60 text-slate-400 hover:text-slate-200 hover:border-slate-400'
          }`}
          title="编辑源配置"
        >
          配置
        </button>
        <FieldSelect
          value={intervalMinutes}
          onChange={(n) => onInterval(id, displayName, n)}
          options={INTERVALS}
          title="轮询间隔（分钟）"
          suffix="m"
          className="shrink-0"
        />
        <Toggle on={enabled} disabled={busy} onChange={(v) => onToggle(id, displayName, v)} />
      </div>
      {configuring && (
        <SourceConfigEditor s={s} onSaved={() => setConfiguring(false)} onNotice={onNotice} />
      )}
    </div>
  );
});

interface Props {
  hotspots: Hotspot[];
  refreshKey: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onNotice: (msg: string) => void;
  view: HotspotView;
  onViewChange: (patch: Partial<HotspotView>) => void;
  total: number | null;
  sources: Source[];
  ranges: Range[];
}

const INTERVALS = [5, 10, 15, 30, 60];

export default function Dashboard({ hotspots, refreshKey, hasMore, loadingMore, onLoadMore, onNotice, view, onViewChange, total, sources, ranges }: Props) {
  const statsPoll = usePoll(getStats, 8000, [refreshKey]);
  const aiPoll = usePoll(getAiSystem, 8000, [refreshKey]);
  const alertsPoll = usePoll(() => getAlerts(12), 15000, []);
  const keywordsPoll = usePoll(getKeywords, 30000, []);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);
  /** 数据源本地乐观覆盖：切换立即反馈，服务端确认后写入同值，避免等整页轮询 */
  const [srcPending, setSrcPending] = useState<Record<number, Partial<Source>>>({});
  const [srcBusyId, setSrcBusyId] = useState<number | null>(null);
  /** AI 依据折叠区：父组件持有的展开 id 集合（单卡切换 + 一键全部展开/折叠） */
  const [reasonOpenIds, setReasonOpenIds] = useState<Set<number>>(new Set());

  const stats = statsPoll.data;
  const ai = aiPoll.data;
  const alerts = alertsPoll.data ?? [];
  const top = hotspots[0];
  const keywords = (keywordsPoll.data ?? []).filter((k) => k.enabled).map((k) => k.keyword.trim()).filter(Boolean);

  /** 渲染用数据源：本地乐观值优先，轮询真值兜底 */
  const effectiveSources = useMemo(
    () => sources.map((s) => (srcPending[s.id] ? { ...s, ...srcPending[s.id] } : s)),
    [sources, srcPending],
  );

  /** 卡片标签点击 → 套用筛选；关键词落到搜索框 */
  function handleTagClick(kind: 'source' | 'range' | 'keyword', value: string) {
    onNotice(`筛选 · ${value}`);
    if (kind === 'source') onViewChange({ sources: view.sources.includes(value) ? view.sources : [...view.sources, value] });
    else if (kind === 'range') onViewChange({ range: value });
    else onViewChange({ q: value });
  }

  function handleClear() {
    onViewChange({
      sources: [],
      range: null,
      statuses: [],
      windowMin: null,
      type: null,
      relevanceMin: null,
      scoreMin: null,
      q: '',
    });
    onNotice('已清除全部排序筛选');
  }

  /** 单卡切换 AI 依据折叠 */
  function toggleReason(id: number) {
    setReasonOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allReasonsOpen = hotspots.length > 0 && reasonOpenIds.size >= hotspots.length;

  /** 一键展开/折叠所有卡片的 AI 依据（展开=收录当前全部 id；新到的返回靠单卡切换） */
  function toggleAllReasons() {
    setReasonOpenIds(allReasonsOpen ? new Set() : new Set(hotspots.map((h) => h.id)));
  }

  const setEnabled = useCallback(async (id: number, name: string, v: boolean) => {
    setSrcPending((p) => ({ ...p, [id]: { ...(p[id] ?? {}), enabled: v } }));
    setSrcBusyId(id);
    try {
      const updated = await updateSource(id, { enabled: v });
      setSrcPending((p) => ({ ...p, [id]: { ...(p[id] ?? {}), enabled: updated.enabled } }));
      onNotice(`${name} ${v ? '已启用' : '已停用'}`);
    } catch (e) {
      setSrcPending((p) => ({ ...p, [id]: { ...(p[id] ?? {}), enabled: !v } }));
      onNotice(`操作失败：${(e as Error).message}`);
    } finally {
      setSrcBusyId(null);
    }
  }, [onNotice]);

  const setInterval = useCallback(async (id: number, name: string, minutes: number) => {
    setSrcPending((p) => ({ ...p, [id]: { ...(p[id] ?? {}), intervalMinutes: minutes } }));
    setSrcBusyId(id);
    try {
      const updated = await updateSource(id, { intervalMinutes: minutes });
      setSrcPending((p) => ({ ...p, [id]: { ...(p[id] ?? {}), intervalMinutes: updated.intervalMinutes } }));
      onNotice(`${name} 间隔已改为 ${minutes} 分钟`);
    } catch (e) {
      setSrcPending((p) => {
        const cur = { ...(p[id] ?? {}) };
        delete cur.intervalMinutes;
        return { ...p, [id]: cur };
      });
      onNotice(`操作失败：${(e as Error).message}`);
    } finally {
      setSrcBusyId(null);
    }
  }, [onNotice]);

  async function runAiSelfCheck() {
    setAiBusy(true);
    setAiResult(null);
    try {
      const res = await testAi();
      if (res.ok && res.analysis) {
        setAiResult(`判定 ${res.analysis.verdict} · 相关度 ${res.analysis.relevance} · ${res.analysis.summary}`);
      } else {
        setAiResult(`✘ ${res.error ?? '未知错误'}`);
      }
    } catch (e) {
      setAiResult(`✘ ${(e as Error).message}`);
    } finally {
      setAiBusy(false);
    }
  }

  async function toggleAi(v: boolean) {
    try {
      await setAiEnabled(v);
      aiPoll.reload();
      setAiResult(null);
      onNotice(v ? 'AI 已启用：新条目继续走三道关' : 'AI 已停用：待鉴定条目改走规则降级，零外部调用');
    } catch (e) {
      onNotice(`切换失败：${(e as Error).message}`);
    }
  }

  async function runTestNotify() {
    setNotifyBusy(true);
    try {
      const res = await testNotify();
      if (res.ok) {
        onNotice('测试通知已发出（SSE 已广播，可看顶栏铃铛/浏览器通知）');
        alertsPoll.reload();
      } else {
        onNotice(`测试通知失败：${res.error ?? '未知错误'}`);
      }
    } catch (e) {
      onNotice(`测试通知失败：${(e as Error).message}`);
    } finally {
      setNotifyBusy(false);
    }
  }

  async function shareHotspot(h: Hotspot) {
    try {
      await navigator.clipboard.writeText(`${h.title}\n${h.url}`);
      onNotice('已复制标题 + 链接，去分享吧');
    } catch {
      onNotice('复制失败：请在浏览器地址栏手动复制');
    }
  }

  /** 触底加载：xl 面板内部滚动用 onScroll；<xl 页面滚动用哨兵离视口距离判定 */
  const endRef = useRef<HTMLDivElement>(null);
  const canLoadRef = useRef(true);
  useEffect(() => {
    canLoadRef.current = !loadingMore;
  }, [loadingMore]);

  const requestLoad = useCallback(() => {
    if (!canLoadRef.current || !hasMore) return;
    canLoadRef.current = false;
    onLoadMore();
  }, [hasMore, onLoadMore]);

  function handleFeedScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 220) requestLoad();
  }

  useEffect(() => {
    function onWinScroll() {
      const el = endRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top <= innerHeight + 220) requestLoad();
    }
    window.addEventListener('scroll', onWinScroll, { passive: true });
    return () => window.removeEventListener('scroll', onWinScroll);
  }, [requestLoad]);

  const statsTiles = [
    { label: '热点', value: stats?.hotspots ?? '·', color: 'text-neon' },
    { label: '原始条目', value: stats?.items ?? '·', color: 'text-cyan' },
    { label: '启控关键词', value: stats?.keywordEnabled ?? '·', color: 'text-signal' },
    { label: '通知', value: stats?.alerts ?? '·', color: 'text-warn' },
  ];

  return (
    <div className="h-full flex flex-col space-y-5">
      {/* 首屏带：最新热点（信息扩容）+ 紧凑雷达 */}
      <Reveal className="shrink-0">
        <GlareCard className="rounded-2xl overflow-hidden">
          <section className="relative glass-strong rounded-2xl p-5 overflow-hidden">
          <BorderBeam size={200} duration={14} anchor={90} />
          <div className="flex flex-wrap items-center gap-6">
            <div className="min-w-0 flex-1">
              <div className="hud-label text-[10px] text-signal mb-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-signal shadow-[0_0_8px_#34d399] animate-pulse" />
                最新动态 · 抢第一手
                <span className="h-0.5 flex-1 rounded-full bg-gradient-to-r from-signal/40 via-neon/40 to-transparent" />
              </div>

              {top ? (
                <>
                  <a
                    href={top.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-lg md:text-2xl font-semibold text-slate-50 hover:text-neon transition-colors leading-snug"
                  >
                    {top.title}
                  </a>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono2 text-[11px] text-slate-400">
                    <span>来源 <span className="text-slate-200">{top.sourceKey}</span></span>
                    {top.rangeName && <span>范围 <span className="text-slate-200">{top.rangeName}</span></span>}
                    {top.author && <span>作者 <span className="text-slate-200">{top.author.slice(0, 16)}</span></span>}
                    <span>发布于 <span className="text-slate-200">{relTime(top.publishedAt)}</span></span>
                    <span>相关度 <span className="text-neon">{top.aiRelevance}</span></span>
                    <span>热度 <span className="text-warn">{top.hotScore}</span></span>
                  </div>
                  {top.summaryZh && (
                    <p className="mt-2 text-xs text-slate-300/80 leading-relaxed max-w-2xl line-clamp-2">{top.summaryZh}</p>
                  )}
                </>
              ) : (
                <div className="text-lg md:text-xl text-slate-500 animate-pulse">等待雷达捕获热点……</div>
              )}
            </div>
            <div className="w-44 sm:w-52 shrink-0 -mb-2">
              <Radar compact hotspots={hotspots} count={stats?.hotspots ?? hotspots.length} />
            </div>
          </div>
        </section>
        </GlareCard>
      </Reveal>

      {/* 主舱：右栏自然高度驱动页面；items-stretch 使左流面板拉满至右栏底边齐平，xl 下列表内部滚动 */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5 items-stretch">
        {/* 左：统计 + 热点流（随右列拉升等高自适应） */}
        <div className="flex flex-col gap-5 min-w-0 min-h-0">
          <GlareCard className="rounded-2xl shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {statsTiles.map((s) => (
                <div key={s.label} className="glass rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                    <div className={`hud-display text-2xl ${s.color} glow-text`}>{s.value}</div>
                  </div>
                  <div className="hud-label text-[9px] text-slate-500 uppercase mt-1 pl-3.5">{s.label}</div>
                </div>
              ))}
            </div>
          </GlareCard>

          <section className="glass rounded-2xl p-5 flex flex-col min-h-0 flex-1">
            <div className="mb-3 flex items-center justify-between shrink-0">
              <h2 className="hud-label text-[11px] text-slate-400">LIVE HOTSPOTS — 实时热点</h2>
              {hotspots.length > 0 && (
                <button
                  onClick={toggleAllReasons}
                  title="一键展开/折叠所有卡片的 AI 依据"
                  className="font-mono2 text-[9px] text-slate-500 hover:text-neon border border-white/10 rounded px-1.5 py-0.5 transition-colors"
                >
                  AI 依据 · {allReasonsOpen ? '全部折叠' : '全部展开'}
                </button>
              )}
            </div>
            <FeedControls
              view={view}
              onChange={onViewChange}
              onClear={handleClear}
              sources={sources}
              ranges={ranges}
              total={total}
              loaded={hotspots.length}
            />
            {/* 列表容器 absolute 脱离行高贡献：左栏不撑破栅格（行高由右栏决定），同时面板可拉满至右栏底边 */}
            <div className="relative min-h-0 flex-1 mt-3">
              <div className="overflow-y-auto overflow-x-hidden pr-1 xl:absolute xl:inset-0" onScroll={handleFeedScroll}>
                <div className="space-y-3">
                {hotspots.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-500">
                    <div className="font-mono2 text-neon/70 mb-2 animate-pulse">◉</div>
                    <p>无匹配热点（可调整排序/筛选，或等采集器入库）</p>
                  </div>
                ) : (
                  hotspots.map((h, i) => (
                    <Reveal key={h.id} y={12} delay={Math.min(i * 0.015, 0.4)}>
                      <HotspotCard
                        h={h}
                        now={Date.now()}
                        onShare={shareHotspot}
                        keywords={keywords}
                        onTagClick={handleTagClick}
                        reasonOpen={reasonOpenIds.has(h.id)}
                        onReasonToggle={() => toggleReason(h.id)}
                      />
                    </Reveal>
                  ))
                )}
                </div>
                {hotspots.length > 0 && (
                  <div ref={endRef} className="pt-2 pb-1">
                    {loadingMore ? (
                      <div className="text-center text-xs text-slate-500 py-2">加载中…</div>
                    ) : hasMore ? (
                      <button
                        onClick={onLoadMore}
                        className="w-full text-center font-mono2 text-[11px] text-neon/80 hover:text-neon py-2 cursor-pointer disabled:opacity-40"
                      >
                        加载更多（已显示 {hotspots.length} 条）
                      </button>
                    ) : (
                      <div className="text-center font-mono2 text-[11px] text-slate-600 py-2">已全部加载 {hotspots.length} 条</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* 右：控制塔（数据源/三道关/通知日志，全内容平铺、无内部滚动条），玻璃反光环绕 */}
        <GlareCard className="min-w-0 rounded-2xl overflow-hidden">
          <aside className="flex flex-col gap-4 min-w-0 h-full">
          <section className="glass rounded-2xl p-4 shrink-0">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="hud-label text-[11px] text-slate-400">DATA SOURCES — 数据源</h2>
              <span className="font-mono2 text-[11px] text-slate-500">
                {effectiveSources.filter((s) => s.enabled).length}/{effectiveSources.length} 在线
              </span>
            </div>
            <div className="space-y-2">
              {effectiveSources.length === 0 ? (
                <div className="text-sm text-slate-500 py-4 text-center">加载数据源中……</div>
              ) : (
                effectiveSources.map((s) => (
                  <SourceRow
                    key={s.id}
                    id={s.id}
                    displayName={s.displayName}
                    sourceKey={s.sourceKey}
                    enabled={s.enabled}
                    intervalMinutes={s.intervalMinutes}
                    lastRunAt={s.lastRunAt}
                    extraJson={s.extraJson}
                    busy={srcBusyId === s.id}
                    onToggle={setEnabled}
                    onInterval={setInterval}
                    onNotice={onNotice}
                  />
                ))
              )}
            </div>
          </section>

          <div className="glass rounded-2xl p-4 shrink-0">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="hud-label text-[11px] text-slate-400">AI PIPELINE — 三道关</h2>
              {ai && !ai.enabled && (
                <span className="font-mono2 text-[10px] text-warn border border-warn/40 rounded px-1.5 py-px">已停用</span>
              )}
              {ai && ai.enabled && !ai.configured && (
                <span className="font-mono2 text-[10px] text-warn border border-warn/40 rounded px-1.5 py-px">降级模式</span>
              )}
            </div>
            {ai ? (
              <div className="space-y-2">
                {/* 处理进度：待鉴定队列 + 冷却倒计时 */}
                <div className="font-mono2 text-[11px] flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
                  <span className={ai.enabled ? 'text-slate-300' : 'text-slate-500'}>
                    待鉴定 <b className={ai.pendingCount > 0 ? 'text-neon' : 'text-slate-400'}>{ai.pendingCount}</b> 条
                  </span>
                  <span className="text-slate-400 shrink-0">
                    {ai.pendingCount === 0
                      ? '队列已清空'
                      : ai.cooldownRemainingMs > 0 && ai.enabled
                        ? <AiCooldown endAt={ai.lastProcessedAt > 0 ? ai.lastProcessedAt + ai.cooldownMs : 0} />
                        : '等待下一轮调度'}
                  </span>
                </div>
                {/* 运行参数（去掉模型与服务信息） */}
                <div className={`font-mono2 text-[11px] ${ai.enabled ? 'text-slate-400' : 'text-slate-600'}`}>
                  相关阈值 <span className="text-slate-200">{ai.minRelevance}</span> · 每轮{' '}
                  <span className="text-slate-200">{ai.maxPerRun}</span> 条 · 熔断{' '}
                  <span className={ai.failStreak >= 3 ? 'text-danger' : 'text-slate-200'}>{ai.failStreak}/3</span>
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  手动「采集」会连续处理队列；自动轮询按冷却节流
                </p>
              </div>
            ) : (
              <div className="text-xs text-slate-500">读取 AI 配置中……</div>
            )}
            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono2 text-[11px] text-slate-400">
                AI 开关 <span className="text-slate-600">（免改 .env）</span>
              </span>
              {ai ? <Toggle on={ai.enabled} onChange={toggleAi} /> : <span className="font-mono2 text-slate-600 text-xs">·</span>}
            </div>
            {ai && !ai.enabled && (
              <p className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">
                已停用：待鉴定条目改走规则降级，零外部调用；下次重启仍保持此状态
              </p>
            )}
            <button
              onClick={runAiSelfCheck}
              disabled={aiBusy || !ai?.configured || !ai?.enabled}
              className="mt-3 w-full px-3 py-1.5 rounded-lg glass text-neon text-xs tracking-wider hover:border-neon/40 disabled:opacity-40 cursor-pointer transition-colors"
            >
              {aiBusy ? '自检中（可能需 20s+）…' : !ai?.enabled ? 'AI 已停用，需开启后才能自检' : '⟳ AI 自检（真实调用）'}
            </button>
            {aiResult && <div className="mt-2 text-[11px] text-slate-300 leading-relaxed">{aiResult}</div>}
          </div>

          <div className="glass rounded-2xl p-4 flex flex-col shrink-0">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="hud-label text-[11px] text-slate-400">NOTIFY LOG — 通知日志</h2>
              <button
                onClick={runTestNotify}
                disabled={notifyBusy}
                className="px-2.5 py-1 rounded-lg border border-warn/40 text-warn text-[10px] hover:bg-warn/10 disabled:opacity-40 cursor-pointer transition-colors font-mono2"
              >
                {notifyBusy ? '发送中…' : '发送测试通知'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">经顶栏铃铛授权浏览器通知；SSE 实时推送命中告警</p>
            <ul className="space-y-1.5 pr-1 max-h-[260px] overflow-y-auto">
              {alerts.length === 0 ? (
                <li className="text-xs text-slate-600 py-4 text-center">暂无通知（AI 判 real 且命中关键词时触发）</li>
              ) : (
                alerts.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-md glass px-2 py-1.5">
                    <span className="shrink-0 font-mono2 text-[10px] text-neon border border-neon/25 rounded px-1 py-px">
                      {a.keyword}
                    </span>
                    <span className="min-w-0 flex-1 text-xs text-slate-300 truncate" title={a.title ?? ''}>
                      {a.title ?? '(无标题)'}
                    </span>
                    <span className="shrink-0 font-mono2 text-[10px] text-slate-500">{relTime(a.triggeredAt)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          </aside>
        </GlareCard>
      </div>
    </div>
  );
}