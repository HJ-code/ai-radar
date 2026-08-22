import { motion } from 'framer-motion';
import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { cn } from '../../lib/utils.ts';

interface CardSpotlightProps {
  children: ReactNode;
  className?: string;
  /** 光斑半径（px） */
  radius?: number;
  color?: string;
  /** 光斑是否超出卡片 */
  overflow?: boolean;
}

/** Aceternity CardSpotlight：鼠标跟随的径向聚光卡片 */
export function CardSpotlight({ children, className, radius = 260, color = '#38e8ff', overflow }: CardSpotlightProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = divRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <motion.div
      ref={divRef}
      whileHover={{ scale: 1.006 }}
      transition={{ duration: 0.2 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn('group relative', overflow && 'overflow-visible', className)}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute z-0 rounded-full opacity-0 transition-opacity duration-500"
        animate={{ opacity: isHovered ? 1 : 0 }}
        style={{
          left: mousePosition.x,
          top: mousePosition.y,
          translateX: '-50%',
          translateY: '-50%',
          width: radius,
          height: radius,
          background: `radial-gradient(circle at center, ${color}2e, transparent 70%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}