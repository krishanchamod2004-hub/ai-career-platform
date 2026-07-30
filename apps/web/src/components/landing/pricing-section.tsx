import Link from 'next/link';
import { ArrowRight, Check, KeyRound, Sparkles, X, Zap } from 'lucide-react';
import { PLAN_CATALOG, PlanTier } from '@ai-career/shared';
import { Button } from '@/components/ui/button';
import { Reveal, Section, SectionHeading } from '@/components/landing/motion-primitives';

/**
 * Read from the shared catalog rather than hardcoded: this number now sits next to
 * a working checkout button, so a stale price here would be quoting a figure the
 * user is not actually charged.
 */
const PRO_MONTHLY_USD =
  PLAN_CATALOG.find((plan) => plan.tier === PlanTier.PRO)?.monthlyPriceUsd ?? 0;

interface PlanRow {
  label: string;
  free: React.ReactNode;
  pro: React.ReactNode;
}

const ROWS: PlanRow[] = [
  { label: 'AI evaluations (A–F scoring)', free: 'Unlimited, via your key', pro: 'Unlimited, managed keys' },
  { label: 'Resume tailoring & cover letters', free: true, pro: true },
  { label: 'Job scraping frequency', free: 'Standard schedule', pro: 'Automated daily, priority proxies' },
  { label: 'Early access to new listings', free: false, pro: '6–12h head start' },
  { label: 'Advanced filters (skills, visa, source)', free: false, pro: true },
  { label: 'Application analytics', free: false, pro: true },
];

/**
 * Landing-page teaser for the BYOK vs managed-key distinction. The authoritative
 * plan catalog (with live limits from the API) lives at /pricing — this section
 * exists to sell the "why," not to duplicate the exact numbers, so the two pages
 * can't silently drift out of sync.
 */
export function PricingSection() {
  return (
    <Section id="pricing">
      <SectionHeading
        eyebrow="Pricing"
        title="Bring your own key, or let us manage it"
        description="Every core feature works on the free tier — you just choose whose API key pays for the tokens."
      />

      <div className="mt-16 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div className="glass-card flex h-full flex-col rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-semibold">Free — BYOK</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Bring your own Anthropic or OpenAI key. Unlimited scans and tailoring — you only pay
              your provider for tokens, at cost, with zero markup from us.
            </p>
            <p className="mt-6 text-3xl font-bold">
              $0<span className="text-sm font-normal text-muted-foreground">/month</span>
            </p>

            <RowList rows={ROWS} column="free" />

            <Button className="mt-8 w-full" variant="outline" asChild>
              <Link href="/register">
                Start free with your key
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="glass-card relative flex h-full flex-col overflow-hidden rounded-2xl border-primary/50 p-6 shadow-lg sm:p-8">
            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Most popular
            </span>

            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Zap className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-semibold">Pro — managed keys</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              No API key to manage. We run evaluations on managed keys and layer on automated daily
              scraping with priority proxy access for faster, deeper coverage.
            </p>
            <p className="mt-6 text-3xl font-bold">
              ${PRO_MONTHLY_USD}
              <span className="text-sm font-normal text-muted-foreground">/month</span>
            </p>

            <RowList rows={ROWS} column="pro" />

            <Button className="mt-8 w-full" asChild>
              <Link href="/pricing">
                See full plan details
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.2} className="mt-6 text-center text-sm text-muted-foreground">
        Full plan catalog, limits and a Premium tier live on the{' '}
        <Link href="/pricing" className="font-medium text-primary underline">
          pricing page
        </Link>
        .
      </Reveal>
    </Section>
  );
}

function RowList({ rows, column }: { rows: PlanRow[]; column: 'free' | 'pro' }) {
  return (
    <ul className="mt-6 space-y-3 text-sm">
      {rows.map((row) => {
        const value = row[column];
        return (
          <li key={row.label} className="flex items-start gap-2.5">
            {value === false ? (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            ) : (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            )}
            <span className={value === false ? 'text-muted-foreground/60' : ''}>
              {row.label}
              {typeof value === 'string' ? (
                <span className="block text-xs text-muted-foreground">{value}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
