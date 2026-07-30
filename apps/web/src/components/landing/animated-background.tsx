'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Ambient animated gradient glows.
 *
 * Pure CSS transforms (no layout properties) so this never triggers reflow;
 * `aria-hidden` because it is decorative and would otherwise be announced as
 * empty content to screen readers.
 */
export function AnimatedMeshBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}
    >
      <motion.div
        className="absolute left-[10%] top-[-10%] h-[36rem] w-[36rem] rounded-full bg-primary/25 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-[5%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/15 blur-3xl dark:bg-fuchsia-400/10"
        animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[-15%] left-[30%] h-[32rem] w-[32rem] rounded-full bg-sky-500/10 blur-3xl dark:bg-sky-400/10"
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Faint grid: gives the hero depth without competing with the copy. */}
      <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--foreground)/0.04)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.04)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
    </div>
  );
}
