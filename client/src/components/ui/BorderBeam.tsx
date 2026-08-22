import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils.ts';

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  anchor?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

/**
 * Aceternity BorderBeam：沿卡片边框运行的渐变光束
 * 通过 mask 只露出 1px 边框环，正方形渐变块绕锚点旋转产生「巡逻光束」。
 */
export function BorderBeam({
  className,
  size = 220,
  duration = 14,
  anchor = 90,
  borderWidth = 1.5,
  colorFrom = '#34d399',
  colorTo = '#38e8ff',
  delay = 0,
}: BorderBeamProps) {
  const style = {
    '--size': size,
    '--duration': `${duration}s`,
    '--anchor': anchor,
    '--border-width': borderWidth,
    '--color-from': colorFrom,
    '--color-to': colorTo,
    '--delay': `${delay}s`,
  } as CSSProperties;

  const beamStyle: CSSProperties = {
    top: `${anchor}%`,
    left: `${anchor}%`,
    width: size,
    height: size,
    background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
    animation: 'border-beam var(--duration) linear infinite',
    animationDelay: `var(--delay)`,
  };

  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit]',
        'border border-transparent',
        className,
      )}
    >
      {/* mask 仅保留边框环，露出旋转光束 */}
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: borderWidth,
        }}
      >
        <div className="absolute" style={beamStyle} />
      </div>
    </div>
  );
}