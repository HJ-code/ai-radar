import { useCallback, useEffect, useRef, useState } from 'react';
import { collectNow, getAiSystem, getHealth, getHotspots } from './api/client.ts';
import { usePoll } from './hooks/usePoll.ts';
import { useStream } from './hooks/useStream.ts';
import { getNotificationPermission, requestNotificationPermission, showBrowserNotification } from './util/notify.ts';
import StatusBar from './components/StatusBar.tsx';
import Ticker from './components/Ticker.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Config from './pages/Config.tsx';

type Tab = 'radar' | 'config';

export default function App() {
  const [tab, setTab] = useState<Tab>('radar');
  const [now, setNow] = useState(() => Date.now());
  const [collecting, setCollecting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [permission, setPermission] = useState(() => getNotificationPermission());
  const noticeTimer = useRef<number | undefined>(undefined);

  const healthPoll = usePoll(getHealth, 30000);
  const aiPoll = usePoll(getAiSystem, 30000);
  const hotspotsPoll = usePoll(() => getHotspots(30), 8000);

  // 顶栏时钟
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const pushNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3500);
  }, []);

  // SSE 告警 → 未读角标 + 浏览器通知 + 站内提示
  useStream(
    useCallback((a) => {
      setUnread((c) => c + 1);
      showBrowserNotification(a.keyword, { body: a.summaryZh || a.title, url: a.url });
      setNotice(`${a.keyword} 命中：${a.title}`);
    }, []),
  );

  async function handleBell() {
    if (permission === 'unsupported') {
      pushNotice('当前环境不支持浏览器通知（需 HTTPS 或 localhost）');
      return;
    }
    const p = await requestNotificationPermission();
    setPermission(p);
    setUnread(0);
    if (p === 'granted') pushNotice('浏览器通知已开启');
    else if (p === 'denied') pushNotice('通知被拒绝，可在浏览器地址栏旁重新允许');
  }

  const bellTitle =
    permission === 'granted'
      ? `浏览器通知已开启（未读 ${unread}）`
      : permission === 'unsupported'
        ? '环境不支持浏览器通知'
        : '点击开启浏览器通知';

  async function handleCollect() {
    if (collecting) return;
    setCollecting(true);
    try {
      const r = await collectNow();
      pushNotice(
        `采集完成：新增 ${r.added} 条 · AI 处理 ${r.aiProcessed} 条${r.errors.length ? ` · ${r.errors.length} 个源出错` : ''}`,
      );
      setRefreshKey((k) => k + 1);
    } catch (e) {
      pushNotice(`采集失败：${(e as Error).message}`);
    } finally {
      setCollecting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <StatusBar
        health={healthPoll.data}
        ai={aiPoll.data}
        now={now}
        collecting={collecting}
        onCollect={handleCollect}
        lastError={healthPoll.error}
        unread={unread}
        onBell={handleBell}
        bellTitle={bellTitle}
      />

      {notice && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg border border-neon/40 bg-panel/95 text-sm text-neon shadow-[0_0_20px_rgba(56,232,255,0.25)]">
          {notice}
        </div>
      )}

      {/* 导航标签 */}
      <nav className="max-w-[1400px] mx-auto w-full px-4 flex gap-1 pt-2">
        {(
          [
            ['radar', '雷达扫描'],
            ['config', '监控配置'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-1.5 text-sm tracking-wider border-b-2 transition-colors ${
              tab === k ? 'border-neon text-neon' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 pt-3 pb-8">
        {tab === 'radar' ? (
          <Dashboard hotspots={hotspotsPoll.data ?? []} refreshKey={refreshKey} onNotice={pushNotice} />
        ) : (
          <Config refreshKey={refreshKey} onNotice={pushNotice} />
        )}
      </main>

      {/* 底部行情条 */}
      <footer className="sticky bottom-0 border-t border-line/70 bg-abyss/85 backdrop-blur px-4 py-2">
        <div className="max-w-[1400px] mx-auto flex items-center gap-4">
          <span className="font-mono2 text-[11px] text-neon shrink-0">▚ TICKER</span>
          <Ticker hotspots={hotspotsPoll.data ?? []} />
        </div>
      </footer>
    </div>
  );
}