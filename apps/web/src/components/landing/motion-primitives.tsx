'use client';

import * as React from 'react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Shared entry animation primitives for the landing page.
 *
 * Centralized so every section fades/slides in with the same easing and
 * duration — a marketing page with inconsistent motion timing reads as
 * unpolished even when each section looks fine in isolation.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: EASE } },
};

export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: EASE } },
};

/** Wraps children in a stagger container; direct children read `staggerItem`. */
export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

export interface RevealProps extends React.ComponentPropsWithoutRef<typeof motion.div> {
  /** Delay in seconds before this element's own animation starts. */
  delay?: number;
  variants?: Variants;
  as?: 'div' | 'section';
}

/**
 * Fires its animation once, the first time it scrolls into view.
 * `viewport.once` avoids replaying on every scroll direction change, which
 * looks janky on a page this long.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  variants = fadeUpVariants,
  as = 'div',
  ...props
}: RevealProps) {
  const Component = as === 'section' ? motion.section : motion.div;
  return (
    <Component
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={variants}
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
}

/** Stagger group — pair with `StaggerItem` children for a cascading reveal. */
export function StaggerGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={staggerContainerVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  variants = fadeUpVariants,
}: {
  children: React.ReactNode;
  className?: string;
  variants?: Variants;
}) {
  return (
    <motion.div variants={variants} className={className}>
      {children}
    </motion.div>
  );
}

/** Section wrapper: consistent max-width, vertical rhythm, and scroll anchor id. */
export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn('relative py-20 sm:py-28', className)}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        'mx-auto max-w-2xl',
        align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      {eyebrow ? (
        <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 text-lg text-muted-foreground">{description}</p>
      ) : null}
    </Reveal>
  );
}
