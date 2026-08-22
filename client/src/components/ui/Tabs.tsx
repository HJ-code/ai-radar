import { AnimatePresence, motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils.ts';

export interface TabItem {
  value: string;
  title: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  className?: string;
  defaultActive?: string;
}

/** Aceternity 风格 Tabs：layoutId 滑动指示条 + 内容淡入淡出 */
export function Tabs({ tabs, className, defaultActive }: TabsProps) {
  const [active, setActive] = useState(defaultActive ?? tabs[0]?.value);
  const current = tabs.find((t) => t.value === active) ?? tabs[0];

  return (
    <div className={cn('flex flex-col', className)}>
      <div role="tablist" className="flex gap-1">
        {tabs.map((t) => {
          const isActive = t.value === active;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.value)}
              className={cn(
                'relative px-4 py-2 text-sm tracking-wider transition-colors cursor-pointer',
                isActive ? 'text-neon' : 'text-slate-500 hover:text-slate-300',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="tab-indicator"
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-neon shadow-[0_0_8px_#38e8ff]"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{t.title}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.value}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {current.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}