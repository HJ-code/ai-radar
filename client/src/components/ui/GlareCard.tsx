import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { cn } from '../../lib/utils.ts';

interface GlareCardProps {
  children: ReactNode;
  className?: string;
  /** 反光白高光强度（0-1），越大越亮 */
  intensity?: number;
  /** 反光光斑半径（px） */
  radius?: number;
}

/** Aceternity GlareCard：玻璃反光——白色高光在面板表面跟随鼠标游走，制造「玻璃受光」质感 */
export function GlareCard({ children, className, intensity = 0.16, radius = 360 }: GlareCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0, on: false });

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos((p) => ({ ...p, x: e.clientX - rect.left, y: e.clientY - rect.top }));
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setPos((p) => ({ ...p, on: true }))}
      onMouseLeave={() => setPos((p) => ({ ...p, on: false }))}
      className={cn('relative', className)}
    >
      {/* 反光层：半透明玻璃面板透出高光 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500"
        style={{
          opacity: pos.on ? 1 : 0,
          background: `radial-gradient(${radius}px circle at ${pos.x}px ${pos.y}px, rgba(255, 255, 255, ${intensity}), transparent 66%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}