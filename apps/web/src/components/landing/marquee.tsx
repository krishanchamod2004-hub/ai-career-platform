'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface MarqueeProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds for one full loop; lower is faster. */
  durationSeconds?: number;
  reverse?: boolean;
}

/**
 * Infinite horizontal scroller.
 *
 * The track is rendered twice back-to-back and animated by exactly -50%, so the
 * loop point is seamless regardless of content width. Pure CSS animation
 * (defined in globals.css) rather than Framer Motion — a decorative infinite
 * loop doesn't need JS-driven animation and this respects `prefers-reduced-motion`
 * for free via the `motion-safe:` variant.
 */
export function Marquee({ children, className, durationSeconds = 32, reverse }: MarqueeProps) {
  return (
    <div className={cn('group relative flex overflow-hidden', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center gap-10 motion-safe:animate-marquee group-hover:[animation-play-state:paused]',
          reverse && 'motion-safe:[animation-direction:reverse]',
        )}
        style={{ animationDuration: `${durationSeconds}s` }}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center gap-10 motion-safe:animate-marquee group-hover:[animation-play-state:paused]',
          reverse && 'motion-safe:[animation-direction:reverse]',
        )}
        style={{ animationDuration: `${durationSeconds}s` }}
      >
        {children}
      </div>

      {/* Edge fades so the loop seam is hidden under the section background. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent sm:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent sm:w-32" />
    </div>
  );
}
