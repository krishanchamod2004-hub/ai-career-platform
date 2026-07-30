'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  Award,
  Bell,
  FileText,
  KeyRound,
  LayoutGrid,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal, Section, SectionHeading } from '@/components/landing/motion-primitives';

export function FeaturesBentoSection() {
  return (
    <Section id="features" className="bg-muted/20">
      <SectionHeading
        eyebrow="Platform"
        title="Everything a modern job search needs, in one place"
        description="Six systems working together — scoring, tailoring, tracking and alerting — so you spend your time interviewing, not searching."
      />

      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
        <Reveal className="lg:col-span-2 lg:row-span-1">
          <AiScoringCard />
        </Reveal>
        <Reveal delay={0.08}>
          <CvTailorCard />
        </Reveal>
        <Reveal delay={0.16}>
          <ByokCard />
        </Reveal>
        <Reveal delay={0.24} className="lg:col-span-2">
          <KanbanCard />
        </Reveal>
        <Reveal delay={0.32}>
          <div className="grid h-full gap-4">
            <CoverLetterCard />
            <JobAlertsCard />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function BentoCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'glass-card group relative flex h-full flex-col overflow-hidden rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1',
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function AiScoringCard() {
  const rings = [
    { grade: 'A', value: 94, color: 'stroke-emerald-500' },
    { grade: 'B', value: 78, color: 'stroke-sky-500' },
    { grade: 'C', value: 58, color: 'stroke-amber-500' },
  ];

  return (
    <BentoCard className="h-full">
      <CardIcon icon={Award} />
      <h3 className="mt-4 text-lg font-semibold">AI scoring engine</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Every listing gets an A–F grade from a weighted rubric — skills, experience, compensation,
        location fit and growth potential.
      </p>

      <div className="mt-6 flex flex-1 items-end gap-6">
        {rings.map((ring) => (
          <div key={ring.grade} className="flex flex-col items-center gap-2">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <svg viewBox="0 0 40 40" className="h-16 w-16 -rotate-90">
                <circle cx="20" cy="20" r="17" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                <motion.circle
                  cx="20"
                  cy="20"
                  r="17"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className={ring.color}
                  strokeDasharray={2 * Math.PI * 17}
                  initial={{ strokeDashoffset: 2 * Math.PI * 17 }}
                  whileInView={{ strokeDashoffset: 2 * Math.PI * 17 * (1 - ring.value / 100) }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </svg>
              <span className="absolute text-base font-bold">{ring.grade}</span>
            </div>
            <span className="text-xs text-muted-foreground">{ring.value}%</span>
          </div>
        ))}
      </div>
    </BentoCard>
  );
}

function CvTailorCard() {
  return (
    <BentoCard>
      <CardIcon icon={FileText} />
      <h3 className="mt-4 text-lg font-semibold">Instant CV tailor</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Rewrites bullet points to mirror the job description&rsquo;s language.
      </p>

      <div className="mt-4 space-y-2 text-xs">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
          <p className="mb-1 font-medium text-destructive">Before</p>
          <p className="text-muted-foreground">Worked on backend services.</p>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
          <p className="mb-1 font-medium text-emerald-600 dark:text-emerald-400">After</p>
          <p className="text-muted-foreground">
            Built and scaled Node.js microservices handling 2M+ requests/day.
          </p>
        </div>
      </div>
    </BentoCard>
  );
}

function ByokCard() {
  return (
    <BentoCard>
      <CardIcon icon={ShieldCheck} />
      <h3 className="mt-4 text-lg font-semibold">Bring your own key</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Evaluations run on your own Anthropic or OpenAI key — never stored server-side.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium">
          <KeyRound className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Anthropic
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium">
          <KeyRound className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          OpenAI
        </span>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
        Sent per request, forwarded to the vendor, never persisted.
      </p>
    </BentoCard>
  );
}

function KanbanCard() {
  const columns = [
    { label: 'Saved', items: 6 },
    { label: 'Applied', items: 4 },
    { label: 'Interview', items: 2 },
    { label: 'Offer', items: 1 },
  ];

  return (
    <BentoCard>
      <CardIcon icon={LayoutGrid} />
      <h3 className="mt-4 text-lg font-semibold">Application Kanban tracker</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        Drag applications across five stages and watch your funnel analytics update live.
      </p>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {columns.map((column) => (
          <div key={column.label} className="rounded-lg border border-border/60 bg-background p-2">
            <p className="truncate text-[10px] font-medium uppercase text-muted-foreground">
              {column.label}
            </p>
            <div className="mt-2 space-y-1.5">
              {Array.from({ length: Math.min(column.items, 3) }).map((_, index) => (
                <div key={index} className="h-4 rounded bg-primary/10" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </BentoCard>
  );
}

function CoverLetterCard() {
  return (
    <BentoCard className="flex-1">
      <CardIcon icon={Mail} />
      <h3 className="mt-4 text-base font-semibold">AI cover letters &amp; emails</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Draft a tailored cover letter or outreach email in seconds.
      </p>
      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-medium text-primary">
        See an example
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </BentoCard>
  );
}

function JobAlertsCard() {
  return (
    <BentoCard className="flex-1">
      <CardIcon icon={Bell} />
      <h3 className="mt-4 text-base font-semibold">Custom job alerts</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Instant, daily or weekly notifications the moment a high-match role appears.
      </p>
    </BentoCard>
  );
}
