'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Percent, Sparkles, XCircle } from 'lucide-react';
import { Reveal, Section, SectionHeading } from '@/components/landing/motion-primitives';

const RUBRIC_CRITERIA = [
  { label: 'Skills match', weight: 30 },
  { label: 'Experience & seniority', weight: 20 },
  { label: 'Role clarity', weight: 15 },
  { label: 'Compensation', weight: 15 },
  { label: 'Location & work model', weight: 10 },
  { label: 'Growth potential', weight: 10 },
];

const MISSING_KEYWORDS = ['Kubernetes', 'GraphQL federation', 'Terraform'];
const MATCHED_KEYWORDS = ['TypeScript', 'React', 'PostgreSQL', 'System design'];

/**
 * Editorial explainer for the rubric. This is the section that turns "A–F
 * grade" from a marketing claim into something a skeptical visitor can verify:
 * it shows the actual weights and a worked example (match % + missing keywords)
 * rather than asserting "our AI is smart."
 */
export function ScoringExplainerSection() {
  return (
    <Section id="how-scoring-works">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            eyebrow="How AI scoring works"
            title="Understanding the A–F career evaluation rubric"
            align="left"
            className="mx-0 max-w-xl"
          />

          <Reveal delay={0.1} className="mt-6 max-w-xl space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Your master resume and each job description are compared across six weighted
              criteria. The model scores every criterion individually on a 1.0–5.0 scale — it never
              invents an overall number. Your dashboard computes the weighted average and maps it to
              a letter grade, so the math behind every grade is always inspectable.
            </p>
            <p>
              That also means a job can score high on skills match but still land a B or C overall
              if compensation or seniority don&rsquo;t line up — the grade reflects the whole
              picture, not a single keyword hit.
            </p>
          </Reveal>

          <Reveal delay={0.18} className="mt-8 space-y-3">
            {RUBRIC_CRITERIA.map((criterion, index) => (
              <div key={criterion.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{criterion.label}</span>
                  <span className="text-muted-foreground">{criterion.weight}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-500"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${criterion.weight}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.06, duration: 0.7, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <MiniArticleCard />
        </Reveal>
      </div>
    </Section>
  );
}

function MiniArticleCard() {
  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Worked example
        </span>
        <span className="flex flex-col items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
          <span className="text-sm font-bold leading-none text-emerald-600 dark:text-emerald-400">
            B
          </span>
        </span>
      </div>

      <p className="mt-4 text-sm font-medium">Staff Backend Engineer — Remote</p>

      <div className="mt-5 flex items-center gap-3 rounded-xl border border-border/60 bg-background p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Percent className="h-5 w-5 text-primary" aria-hidden="true" />
        </span>
        <div>
          <p className="text-2xl font-bold tabular-nums">82%</p>
          <p className="text-xs text-muted-foreground">Overall keyword &amp; skill match</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Matched
          </p>
          <ul className="space-y-1.5">
            {MATCHED_KEYWORDS.map((keyword) => (
              <li
                key={keyword}
                className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400"
              >
                {keyword}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Missing
          </p>
          <ul className="space-y-1.5">
            {MISSING_KEYWORDS.map((keyword) => (
              <li
                key={keyword}
                className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400"
              >
                {keyword}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-xl border border-border/60 bg-background p-3 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
        Skill gap: add infrastructure-as-code experience to your resume — three listings this week
        required it explicitly.
      </div>
    </div>
  );
}
