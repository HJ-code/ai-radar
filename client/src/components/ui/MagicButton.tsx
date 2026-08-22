import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/utils.ts';

interface MagicButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  children: ReactNode;
  /** 悬停时切换显示的副标签 */
  expanding?: string;
  variant?: 'signal' | 'neon';
}

type Variant = 'signal' | 'neon';

const VARIANTS: Record<Variant, CSSProperties> = {
  signal: {
    color: '#052e22',
    backgroundImage: 'linear-gradient(180deg,#4ade80,#22c55e)',
    boxShadow: '0 0 18px rgba(34,197,94,0.32)',
  },
  neon: {
    color: '#062a4a',
    backgroundImage: 'linear-gradient(180deg,#67e8f9,#22d3ee)',
    boxShadow: '0 0 18px rgba(34,211,238,0.28)',
  },
};

/** 立即采集类 CTA：悬停时主标签左淡出、副标签原位滑入，无重叠无跳宽 */
export function MagicButton({ icon, children, expanding, variant = 'signal', className, ...props }: MagicButtonProps) {
  const style = VARIANTS[variant];

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      {...(props as object)}
      className={cn(
        'group relative inline-flex h-10 min-w-[108px] select-none items-center justify-center gap-2 overflow-hidden rounded-lg px-5 text-[13px] font-semibold tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
        className,
      )}
      style={style}
    >
      <span
        className="absolute inset-0 rounded-lg opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-80"
        style={{ backgroundImage: style.backgroundImage }}
      />
      {icon && <span className="relative z-10 flex shrink-0 items-center">{icon}</span>}
      {/* 主标签 + 副标签同槽位切换，不发生布局跳动 */}
      <span className="relative z-10 flex items-center justify-center">
        <span className="whitespace-nowrap transition-all duration-300 group-hover:-translate-x-2 group-hover:opacity-0">
          {children}
        </span>
        {expanding && (
          <span className="absolute left-0 right-0 flex translate-x-3 items-center justify-center whitespace-nowrap opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
            {expanding}
          </span>
        )}
      </span>
    </motion.button>
  );
}