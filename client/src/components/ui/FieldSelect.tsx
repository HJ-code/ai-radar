import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils.ts';

interface FieldSelectProps {
  value: number;
  onChange: (n: number) => void;
  options: number[];
  title?: string;
  suffix?: '条' | 'm';
  className?: string;
}

/** 自绘下拉：深色展开菜单，与页面风格完全统一（原生 select 的系统样式无法控色） */
export function FieldSelect({ value, onChange, options, title, suffix = '条', className }: FieldSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={rootRef} className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] pl-2.5 pr-2 py-1 font-mono2 text-[11px] font-semibold text-neon tabular-nums cursor-pointer transition-colors hover:border-neon/45"
      >
        {value}{suffix}
        <svg
          className={`h-3 w-3 text-neon/70 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+4px)] z-30 min-w-[84px] rounded-lg border border-white/12 bg-panel2/95 p-1 shadow-[0_10px_28px_rgba(0,0,0,0.55)]"
        >
          {options.map((o) => (
            <button
              key={o}
              type="button"
              role="option"
              aria-selected={o === value}
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
              className={cn(
                'block w-full rounded-md px-2.5 py-1.5 text-left font-mono2 text-[11px] tabular-nums cursor-pointer transition-colors',
                o === value ? 'bg-neon/10 text-neon' : 'text-slate-300 hover:bg-white/5 hover:text-neon',
              )}
            >
              {o}{suffix}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}