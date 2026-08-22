import { useState } from 'react';
import type { FormEvent } from 'react';
import { addKeyword, addRange, getKeywords, getRanges, removeKeyword, removeRange, updateKeyword, updateRange } from '../api/client.ts';
import { usePoll } from '../hooks/usePoll.ts';
import Toggle from '../components/Toggle.tsx';
import { Tabs, type TabItem } from '../components/ui/Tabs.tsx';

interface Props {
  refreshKey: number;
  onNotice: (msg: string) => void;
}

export default function Config({ refreshKey, onNotice }: Props) {
  const [kwText, setKwText] = useState('');
  const [kwNote, setKwNote] = useState('');
  const [rangeName, setRangeName] = useState('');
  const [rangeDesc, setRangeDesc] = useState('');
  const [rangeQueries, setRangeQueries] = useState('');

  const keywordsPoll = usePoll(getKeywords, 20000, [refreshKey]);
  const rangesPoll = usePoll(getRanges, 20000, [refreshKey]);
  const keywords = keywordsPoll.data ?? [];
  const ranges = rangesPoll.data ?? [];

  async function guard<T>(fn: () => Promise<T>, ok: string): Promise<boolean> {
    try {
      await fn();
      onNotice(ok);
      return true;
    } catch (e) {
      onNotice(`操作失败：${(e as Error).message}`);
      return false;
    }
  }

  async function submitKeyword(e: FormEvent) {
    e.preventDefault();
    const kw = kwText.trim();
    if (!kw) return;
    if (await guard(() => addKeyword(kw, kwNote.trim()), `关键词「${kw}」已添加`)) {
      setKwText('');
      setKwNote('');
      keywordsPoll.reload();
    }
  }

  async function submitRange(e: FormEvent) {
    e.preventDefault();
    const name = rangeName.trim();
    if (!name) return;
    if (
      await guard(
        () => addRange({ name, description: rangeDesc.trim(), queriesCsv: rangeQueries.trim() }),
        `监控范围「${name}」已添加`,
      )
    ) {
      setRangeName('');
      setRangeDesc('');
      setRangeQueries('');
      rangesPoll.reload();
    }
  }

  const keywordsTab = (
    <>
      <form onSubmit={submitKeyword} className="flex flex-col sm:flex-row gap-2 mb-5">
        <input
          value={kwText}
          onChange={(e) => setKwText(e.target.value)}
          placeholder="追踪关键词，如 GPT-6"
          className="flex-1 glass rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-neon/50 placeholder:text-slate-600"
        />
        <input
          value={kwNote}
          onChange={(e) => setKwNote(e.target.value)}
          placeholder="备注（可选）"
          className="flex-1 glass rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-neon/50 placeholder:text-slate-600 sm:max-w-[220px]"
        />
        <button
          type="submit"
          disabled={!kwText.trim()}
          className="px-4 py-2 rounded-lg border border-signal/50 text-signal text-sm hover:bg-signal/10 disabled:opacity-40 cursor-pointer transition-colors"
        >
          + 添加
        </button>
      </form>

      <ul className="space-y-2">
        {keywords.length === 0 && <li className="text-sm text-slate-500 py-6 text-center">暂无关键词</li>}
        {keywords.map((k) => (
          <li key={k.id} className="flex items-center gap-3 glass rounded-lg px-3 py-2">
            <Toggle
              on={k.enabled}
              onChange={(v) =>
                guard(() => updateKeyword(k.id, { enabled: v }), `关键词「${k.keyword}」${v ? '已启用' : '已停用'}`).then(
                  (ok) => {
                    if (ok) keywordsPoll.reload();
                  },
                )
              }
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-100">{k.keyword}</div>
              {k.note && <div className="text-[11px] text-slate-500 truncate">{k.note}</div>}
            </div>
            <div className="font-mono2 text-[10px] text-slate-500">
              触发 {k.triggerCount} 次
              {k.lastTriggeredAt
                ? ` · ${new Date(k.lastTriggeredAt).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </div>
            <button
              onClick={() =>
                guard(() => removeKeyword(k.id), `关键词「${k.keyword}」已删除`).then((ok) => {
                  if (ok) keywordsPoll.reload();
                })
              }
              className="text-[11px] text-slate-500 hover:text-danger transition-colors px-2 py-1 cursor-pointer"
            >
              删除
            </button>
          </li>
        ))}
      </ul>
    </>
  );

  const rangesTab = (
    <>
      <form onSubmit={submitRange} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2 mb-5">
        <input
          value={rangeName}
          onChange={(e) => setRangeName(e.target.value)}
          placeholder="范围名，如 AI 业界热点"
          className="glass rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-neon/50 placeholder:text-slate-600"
        />
        <input
          value={rangeDesc}
          onChange={(e) => setRangeDesc(e.target.value)}
          placeholder="描述（可选）"
          className="glass rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-neon/50 placeholder:text-slate-600"
        />
        <input
          value={rangeQueries}
          onChange={(e) => setRangeQueries(e.target.value)}
          placeholder="搜索词，英文逗号分隔，如 OpenAI, Claude, Gemini"
          className="glass rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-neon/50 placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={!rangeName.trim()}
          className="px-4 py-2 rounded-lg border border-signal/50 text-signal text-sm hover:bg-signal/10 disabled:opacity-40 cursor-pointer transition-colors"
        >
          + 添加
        </button>
      </form>

      <ul className="space-y-2">
        {ranges.length === 0 && <li className="text-sm text-slate-500 py-6 text-center">暂无监控范围</li>}
        {ranges.map((r) => {
          const queries = r.queriesCsv.split(',').map((q) => q.trim()).filter(Boolean);
          return (
            <li key={r.id} className="glass rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-3">
                <Toggle
                  on={r.enabled}
                  onChange={(v) =>
                    guard(() => updateRange(r.id, { enabled: v }), `范围「${r.name}」${v ? '已启用' : '已停用'}`).then(
                      (ok) => {
                        if (ok) rangesPoll.reload();
                      },
                    )
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-100">{r.name}</div>
                  {r.description && <div className="text-[11px] text-slate-500 truncate">{r.description}</div>}
                </div>
                <button
                  onClick={() =>
                    guard(() => removeRange(r.id), `范围「${r.name}」已删除`).then((ok) => {
                      if (ok) rangesPoll.reload();
                    })
                  }
                  className="text-[11px] text-slate-500 hover:text-danger transition-colors px-2 py-1 cursor-pointer"
                >
                  删除
                </button>
              </div>
              {queries.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-2">
                  {queries.map((q) => (
                    <span key={q} className="font-mono2 text-[10px] text-neon/70 bg-neon/5 border border-neon/20 rounded px-1.5 py-px">
                      {q}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );

  const tabs: TabItem[] = [
    { value: 'keywords', title: '追踪关键词', content: keywordsTab },
    { value: 'ranges', title: '监控范围', content: rangesTab },
  ];

  return (
    <div className="glass-strong rounded-2xl p-6">
      <Tabs tabs={tabs} defaultActive="keywords" />
    </div>
  );
}