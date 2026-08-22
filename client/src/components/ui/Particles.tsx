import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils.ts';

interface Particle {
  left: string;
  size: number;
  delay: string;
  duration: string;
  opacity: number;
}

function pseudoRand(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Aceternity 风微粒子：确定性伪随机位置，纯 CSS 上浮动画（无逐帧 JS） */
export function Particles({ count = 36, className }: { count?: number; className?: string }) {
  const parts = useMemo<Particle[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(pseudoRand(i, 1) * 100).toFixed(2)}%`,
        size: 1.5 + pseudoRand(i, 2) * 2.2,
        delay: `${(pseudoRand(i, 3) * 14).toFixed(1)}s`,
        duration: `${(16 + pseudoRand(i, 4) * 22).toFixed(1)}s`,
        opacity: 0.15 + pseudoRand(i, 5) * 0.4,
      })),
    [count],
  );

  return (
    <div aria-hidden className={cn('pointer-events-none fixed inset-0 z-0 overflow-hidden', className)}>
      {parts.map((p, i) => (
        <span
          key={i}
          className="particle"
          style={
            {
              left: p.left,
              width: p.size,
              height: p.size,
              '--p-op': p.opacity,
              animationDelay: p.delay,
              animationDuration: p.duration,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}