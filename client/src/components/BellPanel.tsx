import type { AlertLog, NotificationPermission } from '../types.ts';
import { relTime } from '../util/time.ts';

interface Props {
  alerts: AlertLog[];
  permission: NotificationPermission;
  onEnable: () => void;
  onTest: () => void;
  testBusy: boolean;
  onClose: () => void;
}

const PERM: Record<NotificationPermission, { label: string; cls: string }> = {
  granted: { label: '已开启', cls: 'text-signal bg-signal/10 border-signal/30' },
  denied: { label: '已拒绝', cls: 'text-danger bg-danger/10 border-danger/30' },
  default: { label: '未授权', cls: 'text-warn bg-warn/10 border-warn/30' },
  unsupported: { label: '不支持', cls: 'text-slate-400 bg-white/5 border-white/15' },
};

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

/** 顶栏铃铛 → 通知中心：权限开关 + 测试 + 最近通知 */
export function BellPanel({ alerts, permission, onEnable, onTest, testBusy, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="通知中心"
        className="fixed top-14 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-4 border border-white/10 bg-abyss/95 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="hud-label text-[11px] text-slate-400">NOTIFICATION CENTER — 通知中心</h3>
          <button onClick={onClose} aria-label="关闭" className="text-slate-400 hover:text-neon cursor-pointer">
            <CloseIcon />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 glass rounded-lg px-3 py-2 mb-2">
          <span className="text-[12px] text-slate-200">浏览器通知</span>
          <span className={`font-mono2 text-[10px] border border-white/15 rounded-full px-2 py-0.5 ${PERM[permission]?.cls ?? ''}`}>
            {PERM[permission]?.label ?? '未知'}
          </span>
        </div>

        {permission === 'granted' ? (
          <p className="text-[11px] text-slate-500 mb-2">命中关键词时实时弹浏览器通知，点击直达原文。</p>
        ) : permission === 'unsupported' ? (
          <p className="text-[11px] text-warn/80 mb-2">当前环境不支持浏览器通知（需 localhost 或 HTTPS）。</p>
        ) : (
          <button
            onClick={onEnable}
            className="w-full px-3 py-2 rounded-lg bg-gradient-to-r from-signal to-neon text-[#04262a] text-[12px] font-semibold cursor-pointer hover:opacity-90 transition-opacity"
          >
            开启浏览器通知
          </button>
        )}

        <button
          onClick={onTest}
          disabled={testBusy}
          className="w-full px-3 py-2 rounded-lg glass text-neon text-[12px] mb-3 hover:border-neon/40 disabled:opacity-40 cursor-pointer transition-colors"
        >
          {testBusy ? '发送中…' : '发送测试通知'}
        </button>

        <div className="hud-label text-[9px] text-slate-500 mb-1.5">RECENT — 最近通知</div>
        <ul className="space-y-1.5 overflow-y-auto max-h-[220px] pr-1">
          {alerts.length === 0 ? (
            <li className="text-[11px] text-slate-600 py-3 text-center">暂无通知</li>
          ) : (
            alerts.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-md glass px-2 py-1.5">
                <span className="shrink-0 font-mono2 text-[10px] text-neon border border-neon/25 rounded px-1 py-px">
                  {a.keyword}
                </span>
                <span className="min-w-0 flex-1 text-[11px] text-slate-300 truncate" title={a.title ?? ''}>
                  {a.title ?? '(无标题)'}
                </span>
                <span className="shrink-0 font-mono2 text-[9px] text-slate-500">{relTime(a.triggeredAt)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
}