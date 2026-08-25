import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { collectNow, getAiSystem, getAlerts, getHealth, getHotspots, testNotify } from './api/client.ts';
import type { Hotspot } from './types.ts';
import { usePoll } from './hooks/usePoll.ts';
import { useStream } from './hooks/useStream.ts';
import { getNotificationPermission, requestNotificationPermission, showBrowserNotification } from './util/notify.ts';
import { BackgroundBeams } from './components/ui/BackgroundBeams.tsx';
import { Particles } from './components/ui/Particles.tsx';
import { BellPanel } from './components/BellPanel.tsx';
import StatusBar from './components/StatusBar.tsx';
import Ticker from './components/Ticker.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Config from './pages/Config.tsx';

type Tab = 'radar' | 'config';

const TABS: [Tab, string][] = [
  ['radar', '雷达扫描'],
  ['config', '监控配置'],
];

export default function App() {
  const [tab, setTab] = useState<Tab>('radar');
  const [now, setNow] = useState(() => Date.now());
  const [collecting, setCollecting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [permission, setPermission] = useState(() => getNotificationPermission());
  const [bellOpen, setBellOpen] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  /** 热点流：首屏一页 + 触底加载更多累计；每页固定 30 条 */
  const FEED_PAGE = 30;
  const [feed, setFeed] = useState<Hotspot[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const feedInited = useRef(false);
  const noticeTimer = useRef<number | undefined>(undefined);

  const healthPoll = usePoll(getHealth, 30000);
  const aiPoll = usePoll(getAiSystem, 30000);
  const alertsPoll = usePoll(() => getAlerts(10), 15000, []);

  /** 每 8s 拉首屏：新热点前插、已有条目就地刷新，保留已累计的更多页 */
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const fresh = await getHotspots(FEED_PAGE);
        if (!alive || fresh.length === 0) return;
        if (!feedInited.current) {
          feedInited.current = true;
          setHasMore(fresh.length === FEED_PAGE);
        }
        setFeed((prev) => {
          if (prev.length === 0) return fresh;
          const ids = new Set(prev.map((h) => h.id));
          const byId = new Map(fresh.map((h) => [h.id, h] as const));
          return [...fresh.filter((h) => !ids.has(h.id)), ...prev.map((h) => byId.get(h.id) ?? h)];
        });
      } catch {
        /* 拉取失败保持现状 */
      }
    };
    void tick();
    timer = window.setInterval(tick, 8000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [refreshKey]);

  const loadMore = useCallback(async () => {
    const last = feed[feed.length - 1];
    if (!last || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const more = await getHotspots(FEED_PAGE, `${last.publishedAt}|${last.hotScore}|${last.id}`);
      setFeed((prev) => {
        const ids = new Set(prev.map((h) => h.id));
        return [...prev, ...more.filter((h) => !ids.has(h.id))];
      });
      setHasMore(more.length === FEED_PAGE);
    } finally {
      setLoadingMore(false);
    }
  }, [feed, loadingMore, hasMore]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const pushNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3500);
  }, []);

  useStream(
    useCallback((a) => {
      setUnread((c) => c + 1);
      showBrowserNotification(a.keyword, { body: a.summaryZh || a.title, url: a.url });
      pushNotice(`${a.keyword} 命中：${a.title}`);
    }, [pushNotice]),
  );

  function handleBell() {
    setBellOpen((o) => !o);
    setUnread(0);
    // 未授权时顺带请求权限
    if (permission === 'default') {
      void requestNotificationPermission().then((p) => setPermission(p));
    }
  }

  async function runBellTest() {
    setNotifyBusy(true);
    try {
      const r = await testNotify();
      pushNotice(r.ok ? '测试通知已发出，请查看浏览器通知与铃铛角标' : `测试通知失败：${r.error ?? '未知错误'}`);
      alertsPoll.reload();
    } catch (e) {
      pushNotice(`测试通知失败：${(e as Error).message}`);
    } finally {
      setNotifyBusy(false);
    }
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
    <>
      <div className="aurora" />
      <BackgroundBeams className="fixed inset-0 z-0" />
      <Particles />
      <div className="relative z-10 h-screen flex flex-col overflow-y-auto pb-16">
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

        {bellOpen && (
          <BellPanel
            alerts={alertsPoll.data ?? []}
            permission={permission}
            onEnable={() => void requestNotificationPermission().then((p) => setPermission(p))}
            onTest={runBellTest}
            testBusy={notifyBusy}
            onClose={() => setBellOpen(false)}
          />
        )}

        {notice && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg glass-strong text-sm text-neon shadow-[0_0_24px_rgba(56,232,255,0.28)]">
            {notice}
          </div>
        )}

        {/* 导航 */}
        <nav className="max-w-[1400px] mx-auto w-full px-4 flex gap-1 pt-3">
          {TABS.map(([k, label]) => {
            const active = tab === k;
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`relative px-4 py-1.5 text-sm cursor-pointer transition-colors ${
                  active ? 'text-neon' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className="hud-label text-[11px]">{label}</span>
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-neon shadow-[0_0_10px_#38e8ff]"
                    transition={{ type: 'spring', bounce: 0.25, duration: 0.55 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 pt-4 pb-2">
          {tab === 'radar' ? (
            <Dashboard
              hotspots={feed}
              refreshKey={refreshKey}
              onNotice={pushNotice}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
            />
          ) : (
            <Config refreshKey={refreshKey} onNotice={pushNotice} />
          )}
        </main>

        {/* 底部行情条：fixed 常驻视口最底部；内容底部已由壳层 pb-16 预留空隙避免遮挡 */}
        <footer className="fixed bottom-0 inset-x-0 z-20 border-t border-white/10 bg-abyss/90 backdrop-blur-2xl px-4 py-2.5">
          <div className="max-w-[1400px] mx-auto flex items-center gap-4">
            <span className="hud-label text-[10px] text-neon shrink-0">▚ TICKER</span>
            <Ticker hotspots={feed} />
          </div>
        </footer>
      </div>
    </>
  );
}