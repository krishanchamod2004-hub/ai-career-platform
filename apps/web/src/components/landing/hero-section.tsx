'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  Gauge,
  MapPin,
  Radar,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fadeUpVariants, Reveal, StaggerGroup, StaggerItem } from '@/components/landing/motion-primitives';
import { AnimatedMeshBackground } from '@/components/landing/animated-background';

const MICRO_BADGES = [
  { icon: Radar, label: 'JobSpy live engine' },
  { icon: Target, label: 'A–F match scoring' },
  { icon: Sparkles, label: 'BYOK — bring your own AI key' },
];

const RUBRIC_ROWS = [
  { label: 'Skills match', value: 92 },
  { label: 'Experience fit', value: 88 },
  { label: 'Compensation', value: 76 },
];

/**
 * Hero. The demo preview card is the conversion anchor: visitors decide whether
 * this product is "real" in the first three seconds, so it shows the actual
 * artifact (an A–F graded job card) rather than an abstract illustration.
 */
export function HeroSection() {
  return (
    <div className="relative">
      <AnimatedMeshBackground />

      <div className="mx-auto w-full max-w-7xl px-4 pt-16 sm:px-6 sm:pt-24 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <Reveal>
            <div className="glass-card inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              AI-powered job matching, resumes &amp; interview prep
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              Land your next role with an{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-fuchsia-500 bg-clip-text text-transparent">
                AI career co-pilot
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Discover jobs, build ATS-friendly resumes, generate cover letters, and track every
              application from one beautiful dashboard.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/register">
                  Get started free
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          </Reveal>

          <StaggerGroup className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {MICRO_BADGES.map((badge) => (
              <StaggerItem key={badge.label} variants={fadeUpVariants}>
                <motion.span
                  whileHover={{ y: -2 }}
                  className="glass-card inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-foreground/80"
                >
                  <badge.icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {badge.label}
                </motion.span>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>

        {/* Interactive demo preview: dashboard mockup with a live-graded job card. */}
        <Reveal delay={0.3} className="relative mx-auto mt-16 max-w-4xl pb-8">
          <div
            className="absolute inset-x-8 -bottom-6 -z-10 h-24 rounded-full bg-primary/20 blur-3xl"
            aria-hidden="true"
          />
          <DemoPreviewCard />
        </Reveal>
      </div>
    </div>
  );
}

function DemoPreviewCard() {
  return (
    <div className="glass-card overflow-hidden rounded-2xl shadow-2xl">
      {/* Chrome bar, like a browser/app window, to sell "this is a real product". */}
      <div className="flex items-center gap-2 border-b border-border/50 bg-muted/40 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" aria-hidden="true" />
        <span className="ml-3 text-xs font-medium text-muted-foreground">
          AI Career Platform — Dashboard
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-[1.3fr_1fr]">
        {/* Left: a job card mid-evaluation. */}
        <div className="rounded-xl border border-border/60 bg-card/80 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">Senior Product Engineer</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  Remote · Nimbus Labs
                </p>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.7, rotate: -6 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5"
            >
              <span className="text-lg font-bold leading-none text-emerald-600 dark:text-emerald-400">
                A
              </span>
              <span className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
                4.8 / 5.0
              </span>
            </motion.div>
          </div>

          <div className="mt-5 space-y-3">
            {RUBRIC_ROWS.map((row, index) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">{row.value}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-500"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${row.value}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + index * 0.15, duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-1.5 rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Strong overlap on TypeScript, GraphQL and system design signals.
          </div>
        </div>

        {/* Right: ATS resume score + quick stats. */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border/60 bg-card/80 p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
              ATS resume score
            </div>
            <div className="mt-3 flex items-end gap-2">
              <motion.span
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-3xl font-bold tabular-nums"
              >
                87
              </motion.span>
              <span className="pb-1 text-xs text-muted-foreground">/ 100</span>
              <span className="ml-auto flex items-center gap-1 pb-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                +12
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-emerald-500"
                initial={{ width: 0 }}
                whileInView={{ width: '87%' }}
                viewport={{ once: true }}
                transition={{ delay: 0.55, duration: 0.9, ease: 'easeOut' }}
              />
            </div>
          </div>

          <div className="flex-1 rounded-xl border border-border/60 bg-card/80 p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              This week
            </div>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Jobs scanned</dt>
                <dd className="font-semibold tabular-nums">1,204</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Graded A/B</dt>
                <dd className="font-semibold tabular-nums">38</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Applications tracked</dt>
                <dd className="font-semibold tabular-nums">9</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
