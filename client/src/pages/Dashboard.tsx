import { useState } from 'react';
import type { Hotspot, Source } from '../types.ts';
import { getAiSystem, getAlerts, getSources, getStats, testAi, testNotify, updateSource } from '../api/client.ts';
import { usePoll } from '../hooks/usePoll.ts';
import { relTime } from '../util/time.ts';
import Radar from '../components/Radar.tsx';
import HotspotCard from '../components/HotspotCard.tsx';
import Toggle from '../components/Toggle.tsx';

interface Props {
  hotspots: Hotspot[];
  refreshKey: number;
  onNotice: (msg: string) => void;
}

const INTERVALS = [5, 10, 15, 30, 60];

export default function Dashboard({ hotspots, refreshKey, onNotice }: Props) {
  const statsPoll = usePoll(getStats, 8000, [refreshKey]);
  const sourcesPoll = usePoll(getSources, 8000, [refreshKey]);
  const aiPoll = usePoll(getAiSystem, 30000, [refreshKey]);
  const alertsPoll = usePoll(() => getAlerts(20), 15000, []);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);

  const stats = statsPoll.data;
  const sources = sourcesPoll.data ?? [];
  const ai = aiPoll.data;
  const alerts = alertsPoll.data ?? [];

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

  async function runTestNotify() {
    setNotifyBusy(true);
    try {
      const res = await testNotify();
      if (res.ok) {
        onNotice('测试通知已发出（SSE 已广播，可看顶栏铃铛角标/浏览器通知）');
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-5">
      {/* 左：雷达 + 统计 */}
      <section className="panel rounded-xl border border-line/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono2 text-xs tracking-[0.3em] text-slate-400">SCAN AREA — 雷达扫描区</h2>
          <span className="font-mono2 text-[11px] text-slate-500">
            最近采集 {stats?.lastCollect ? relTime(stats.lastCollect) : '—'}
          </span>
        </div>
        <Radar hotspots={hotspots} count={stats?.hotspots ?? hotspots.length} />

        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '热点', value: stats?.hotspots ?? '·', color: 'text-neon' },
            { label: '原始条目', value: stats?.items ?? '·', color: 'text-cyan' },
            { label: '启控关键词', value: stats?.keywordEnabled ?? '·', color: 'text-signal' },
            { label: '通知', value: stats?.alerts ?? '·', color: 'text-warn' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-line/50 bg-abyss/40 px-3 py-2.5">
              <div className={`font-mono2 text-xl ${s.color} glow-text`}>{s.value}</div>
              <div className="text-[10px] tracking-widest text-slate-500 uppercase mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 右：热点流 */}
      <section className="panel rounded-xl border border-line/60 p-5 flex flex-col min-h-[420px]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono2 text-xs tracking-[0.3em] text-slate-400">LIVE HOTSPOTS — 实时热点</h2>
          <span className="font-mono2 text-[11px] text-neon">{hotspots.length}</span>
        </div>
        <div className="space-y-2.5 overflow-y-auto pr-1" style={{ maxHeight: '62vh' }}>
          {hotspots.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              <div className="font-mono2 text-neon/70 mb-2 animate-pulse">◉</div>
              <p>采集器入库中…… 热点即将抵达雷达屏幕</p>
            </div>
          ) : (
            hotspots.map((h) => <HotspotCard key={h.id} h={h} now={Date.now()} />)
          )}
        </div>
      </section>

      {/* 下：数据源 */}
      <section className="panel rounded-xl border border-line/60 p-5 xl:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono2 text-xs tracking-[0.3em] text-slate-400">DATA SOURCES — 数据源启停 / 间隔</h2>
          <span className="font-mono2 text-[11px] text-slate-500">
            {sources.filter((s) => s.enabled).length}/{sources.length} 在线
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {sources.length === 0 ? (
            <div className="col-span-full text-sm text-slate-500 py-6 text-center">加载数据源中……</div>
          ) : (
            sources.map((s) => (
              <div key={s.id} className="rounded-lg border border-line/50 bg-abyss/40 px-3 py-2.5 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-200 truncate">{s.displayName}</div>
                  <div className="font-mono2 text-[10px] text-slate-500 truncate">
                    {s.sourceKey} · {s.lastRunAt ? `上次 ${relTime(s.lastRunAt)}` : '未运行'}
                  </div>
                </div>
                <select
                  value={s.intervalMinutes}
                  onChange={(e) => setInterval(s, Number(e.target.value))}
                  className="bg-abyss/70 border border-line/60 rounded text-[11px] font-mono2 text-slate-300 px-1 py-0.5"
                  title="轮询间隔（分钟）"
                >
                  {INTERVALS.map((m) => (
                    <option key={m} value={m}>{m}m</option>
                  ))}
                </select>
                <Toggle on={s.enabled} onChange={(v) => setEnabled(s, v)} />
              </div>
            ))
          )}
        </div>
      </section>

      {/* AI 自检 */}
      <section className="panel rounded-xl border border-line/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono2 text-xs tracking-[0.3em] text-slate-400">AI PIPELINE — 三道关</h2>
          {ai && !ai.configured && (
            <span className="font-mono2 text-[10px] text-warn border border-warn/40 rounded px-1.5 py-px">降级模式</span>
          )}
        </div>
        {ai ? (
          <div className="font-mono2 text-[11px] text-slate-400 space-y-1">
            <div>模型：<span className="text-slate-200">{ai.model || '（未配置）'}</span></div>
            <div className="truncate">服务：<span className="text-slate-200" title={ai.baseUrl}>{ai.baseUrl || '—'}</span></div>
            <div>相关阈值 <span className="text-slate-200">{ai.minRelevance}</span> · 每轮 <span className="text-slate-200">{ai.maxPerRun}</span> 条 · 熔断 <span className={`${ai.failStreak >= 3 ? 'text-danger' : 'text-slate-200'}`}>{ai.failStreak}/3</span></div>
          </div>
        ) : (
          <div className="text-xs text-slate-500">读取 AI 配置中……</div>
        )}
        <button
          onClick={runAiSelfCheck}
          disabled={aiBusy || !ai?.configured}
          className="mt-3 w-full px-3 py-1.5 rounded-md border border-neon/40 text-neon text-xs tracking-wider hover:bg-neon/10 disabled:opacity-40 transition-colors"
        >
          {aiBusy ? '自检中（可能需 20s+）…' : '⟳ AI 自检（真实调用）'}
        </button>
        {aiResult && <div className="mt-2 text-[11px] text-slate-300 leading-relaxed">{aiResult}</div>}
      </section>

      {/* 通知日志 */}
      <section className="panel rounded-xl border border-line/60 p-5 flex flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono2 text-xs tracking-[0.3em] text-slate-400">NOTIFY LOG — 通知日志</h2>
          <span className="font-mono2 text-[11px] text-neon">{alerts.length}</span>
        </div>
        <div className="flex items-center gap-2 mb-2 text-[11px] text-slate-500">
          <span>通过顶栏铃铛开启浏览器通知；SSE 实时推送命中告警</span>
          <button
            onClick={runTestNotify}
            disabled={notifyBusy}
            className="ml-auto px-2.5 py-1 rounded border border-warn/40 text-warn text-[10px] hover:bg-warn/10 disabled:opacity-40 transition-colors shrink-0"
          >
            {notifyBusy ? '发送中…' : '发送测试通知'}
          </button>
        </div>
        <ul className="space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: '220px' }}>
          {alerts.length === 0 ? (
            <li className="text-xs text-slate-600 py-6 text-center">暂无通知（AI 判定 real 且命中关键词时触发）</li>
          ) : (
            alerts.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-md border border-line/40 bg-abyss/40 px-2 py-1.5">
                <span className="shrink-0 font-mono2 text-[10px] text-neon border border-neon/30 rounded px-1 py-px">
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
      </section>
    </div>
  );
}