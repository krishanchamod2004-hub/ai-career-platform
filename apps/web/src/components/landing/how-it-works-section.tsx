'use client';

import { motion } from 'framer-motion';
import {
  BarChart2,
  Cpu,
  FileCheck,
  Globe,
  KanbanSquare,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal, Section, SectionHeading } from '@/components/landing/motion-primitives';

const STEPS = [
  {
    number: '01',
    title: 'Multi-portal auto scanning',
    description:
      'Scanning LinkedIn, Indeed, Glassdoor, ZipRecruiter and more in real time, deduplicated into one unified feed.',
    icons: [Search, Globe],
    mockup: <ScanningMockup />,
  },
  {
    number: '02',
    title: 'A–F match evaluation',
    description:
      'Your resume is graded against every job description on a 1.0–5.0 rubric — skills, experience, compensation and more.',
    icons: [Cpu, BarChart2],
    mockup: <ScoringMockup />,
  },
  {
    number: '03',
    title: 'Tailor & track',
    description:
      'One-click ATS resume tailoring, AI cover letters, and a Kanban board that tracks every application to the finish line.',
    icons: [FileCheck, KanbanSquare],
    mockup: <TrackMockup />,
  },
];

export function HowItWorksSection() {
  return (
    <Section id="how-it-works">
      <SectionHeading
        eyebrow="How it works"
        title="From open tabs to offers, in three steps"
        description="Every job that reaches your dashboard has already been scanned, scored and normalized — you only see what's worth your time."
      />

      <div className="mt-16 grid gap-6 lg:grid-cols-3">
        {STEPS.map((step, index) => (
          <Reveal key={step.title} delay={index * 0.12}>
            <div className="glass-card group relative flex h-full flex-col overflow-hidden rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <span className="text-4xl font-bold tracking-tight text-primary/20">
                  {step.number}
                </span>
                <div className="flex gap-1.5">
                  {step.icons.map((Icon, iconIndex) => (
                    <span
                      key={iconIndex}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
                    >
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                  ))}
                </div>
              </div>

              <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>

              <div className="mt-6">{step.mockup}</div>

              {index < STEPS.length - 1 ? (
                <div
                  aria-hidden="true"
                  className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background text-xs text-muted-foreground lg:flex"
                >
                  →
                </div>
              ) : null}
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function ScanningMockup() {
  const sources = ['LinkedIn', 'Indeed', 'Glassdoor'];
  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-card/60 p-4">
      {sources.map((source, index) => (
        <div key={source} className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'relative flex h-2 w-2 rounded-full',
              index === 0 ? 'bg-emerald-500' : 'bg-primary/50',
            )}
          >
            {index === 0 ? (
              <motion.span
                className="absolute inset-0 rounded-full bg-emerald-500"
                animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
              />
            ) : null}
          </span>
          <span className="text-muted-foreground">{source}</span>
          <span className="ml-auto font-medium">{index === 0 ? 'Scanning…' : 'Queued'}</span>
        </div>
      ))}
    </div>
  );
}

function ScoringMockup() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
        <svg viewBox="0 0 40 40" className="h-14 w-14 -rotate-90">
          <circle cx="20" cy="20" r="17" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
          <motion.circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 17}
            initial={{ strokeDashoffset: 2 * Math.PI * 17 }}
            whileInView={{ strokeDashoffset: 2 * Math.PI * 17 * (1 - 0.92) }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
          />
        </svg>
        <span className="absolute text-sm font-bold">A</span>
      </div>
      <div className="text-xs">
        <p className="font-medium">Rubric complete</p>
        <p className="text-muted-foreground">6 criteria weighted &amp; scored</p>
      </div>
    </div>
  );
}

function TrackMockup() {
  const columns = [
    { label: 'Applied', count: 4 },
    { label: 'Interview', count: 2 },
    { label: 'Offer', count: 1 },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-card/60 p-4">
      {columns.map((column) => (
        <div key={column.label} className="space-y-1.5 text-center">
          <p className="text-[10px] font-medium uppercase text-muted-foreground">
            {column.label}
          </p>
          <div className="flex h-10 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
            {column.count}
          </div>
        </div>
      ))}
    </div>
  );
}
