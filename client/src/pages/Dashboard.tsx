import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import type { Hotspot, Source } from '../types.ts';
import { getAiSystem, getAlerts, getKeywords, getSources, getStats, setAiEnabled, testAi, testNotify, updateSource } from '../api/client.ts';
import { usePoll } from '../hooks/usePoll.ts';
import { relTime } from '../util/time.ts';
import Radar from '../components/Radar.tsx';
import HotspotCard from '../components/HotspotCard.tsx';
import Toggle from '../components/Toggle.tsx';
import { BorderBeam } from '../components/ui/BorderBeam.tsx';
import { FieldSelect } from '../components/ui/FieldSelect.tsx';
import { GlareCard } from '../components/ui/GlareCard.tsx';
import { Reveal } from '../components/ui/Reveal.tsx';

interface Props {
  hotspots: Hotspot[];
  refreshKey: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onNotice: (msg: string) => void;
}

const INTERVALS = [5, 10, 15, 30, 60];

export default function Dashboard({ hotspots, refreshKey, hasMore, loadingMore, onLoadMore, onNotice }: Props) {
  const statsPoll = usePoll(getStats, 8000, [refreshKey]);
  const sourcesPoll = usePoll(getSources, 8000, [refreshKey]);
  const aiPoll = usePoll(getAiSystem, 30000, [refreshKey]);
  const alertsPoll = usePoll(() => getAlerts(12), 15000, []);
  const keywordsPoll = usePoll(getKeywords, 30000, []);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);

  const stats = statsPoll.data;
  const sources = sourcesPoll.data ?? [];
  const ai = aiPoll.data;
  const alerts = alertsPoll.data ?? [];
  const top = hotspots[0];
  const keywords = (keywordsPoll.data ?? []).filter((k) => k.enabled).map((k) => k.keyword.trim()).filter(Boolean);

  async function setEnabled(s: Source, v: boolean) {
    try {
      await updateSource(s.id, { enabled: v });
      sourcesPoll.reload();
      onNotice(`${s.displayName} ${v ? '已启用' : '已停用'}`);
    } catch (e) {
      onNotice(`操作失败：${(e as Error).message}`);
    }
  }

  async function setInterval(s: Source, minutes: number) {
    try {
      await updateSource(s.id, { intervalMinutes: minutes });
      sourcesPoll.reload();
      onNotice(`${s.displayName} 间隔已改为 ${minutes} 分钟`);
    } catch (e) {
      onNotice(`操作失败：${(e as Error).message}`);
    }
  }

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
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

          <section className="glass rounded-2xl p-5 flex flex-col min-h-0 flex-1">
            <div className="mb-3 flex items-center justify-between shrink-0">
              <h2 className="hud-label text-[11px] text-slate-400">LIVE HOTSPOTS — 实时热点</h2>
              <span className="font-mono2 text-[11px] text-slate-500">
                已加载 {hotspots.length}
                {stats?.hotspots ? ` · 共 ${stats.hotspots}` : ''}
              </span>
            </div>
            {/* 列表容器 absolute 脱离行高贡献：左栏不撑破栅格（行高由右栏决定），同时面板可拉满至右栏底边 */}
            <div className="relative min-h-0 flex-1">
              <div className="overflow-y-auto overflow-x-hidden pr-1 xl:absolute xl:inset-0" onScroll={handleFeedScroll}>
                <div className="space-y-3">
                {hotspots.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-500">
                    <div className="font-mono2 text-neon/70 mb-2 animate-pulse">◉</div>
                    <p>采集器入库中…… 热点即将抵达雷达屏幕</p>
                  </div>
                ) : (
                  hotspots.map((h, i) => (
                    <Reveal key={h.id} y={12} delay={Math.min(i * 0.015, 0.4)}>
                      <HotspotCard h={h} now={Date.now()} onShare={shareHotspot} keywords={keywords} />
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
                {sources.filter((s) => s.enabled).length}/{sources.length} 在线
              </span>
            </div>
            <div className="space-y-2">
              {sources.length === 0 ? (
                <div className="text-sm text-slate-500 py-4 text-center">加载数据源中……</div>
              ) : (
                sources.map((s) => (
                  <div key={s.id} className="glass rounded-lg px-3 py-1.5 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-200 truncate">{s.displayName}</div>
                      <div className="font-mono2 text-[10px] text-slate-500 truncate">
                        {s.sourceKey} · {s.lastRunAt ? `上次 ${relTime(s.lastRunAt)}` : '未运行'}
                      </div>
                    </div>
                    <FieldSelect
                      value={s.intervalMinutes}
                      onChange={(n) => setInterval(s, n)}
                      options={INTERVALS}
                      title="轮询间隔（分钟）"
                      suffix="m"
                      className="shrink-0"
                    />
                    <Toggle on={s.enabled} onChange={(v) => setEnabled(s, v)} />
                  </div>
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
              <div className={`font-mono2 text-[11px] space-y-1 ${ai.enabled ? 'text-slate-400' : 'text-slate-600'}`}>
                <div>模型：<span className={ai.enabled ? 'text-slate-200' : 'text-slate-500'}>{ai.model || '（未配置）'}</span></div>
                <div className="truncate">服务：<span className={ai.enabled ? 'text-slate-200' : 'text-slate-500'} title={ai.baseUrl}>{ai.baseUrl || '—'}</span></div>
                <div>
                  相关阈值 <span className="text-slate-200">{ai.minRelevance}</span> · 每轮{' '}
                  <span className="text-slate-200">{ai.maxPerRun}</span> 条 · 熔断{' '}
                  <span className={ai.failStreak >= 3 ? 'text-danger' : 'text-slate-200'}>{ai.failStreak}/3</span>
                </div>
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