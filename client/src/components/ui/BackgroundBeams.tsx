import { cn } from '../../lib/utils.ts';

interface Beam {
  d: string;
  w: number;
  dur: string;
}

/** 多条横向飘移信号光束 */
const BEAMS: Beam[] = [
  { d: 'M-300 120C 100 -40, 300 300, 800 160S 1400 -60, 1700 200', w: 2.2, dur: '26s' },
  { d: 'M-300 300C 120 120, 400 480, 900 320S 1500 120, 1800 380', w: 1.6, dur: '34s' },
  { d: 'M-200 60 C 180 -140, 320 200, 760 90 S 1280 -120, 1600 60', w: 1.2, dur: '42s' },
  { d: 'M-300 420C 60 300, 360 560, 820 400S 1320 240, 1700 460', w: 1.1, dur: '30s' },
  { d: 'M-300 180C 80 60, 260 360, 700 220 S 1180 20, 1500 180', w: 1.3, dur: '38s' },
];

/** Aceternity 风格 BackgroundBeams：底层缓慢漂移的多束渐变光（低透明度，不抢内容） */
export function BackgroundBeams({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute -inset-x-40 top-0 h-full opacity-[0.15] blur-[70px]">
        <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 1200 400">
          <defs>
            <linearGradient id="beam-lg" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="28%" stopColor="#34d399" stopOpacity="0.9" />
              <stop offset="55%" stopColor="#38e8ff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          {BEAMS.map((b, i) => (
            <path
              key={i}
              d={b.d}
              fill="none"
              stroke="url(#beam-lg)"
              strokeWidth={b.w}
              strokeLinecap="round"
              className="beam-float"
              style={{ animationDuration: b.dur, animationDelay: `${-i * 4}s` }}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}