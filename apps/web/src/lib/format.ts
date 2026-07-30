import { SalaryPeriod } from '@ai-career/shared';

const PERIOD_SUFFIX: Record<SalaryPeriod, string> = {
  [SalaryPeriod.HOURLY]: '/hr',
  [SalaryPeriod.DAILY]: '/day',
  [SalaryPeriod.WEEKLY]: '/wk',
  [SalaryPeriod.MONTHLY]: '/mo',
  [SalaryPeriod.YEARLY]: '/yr',
};

/** "$95k – $130k/yr", "€60k/yr", or null when a listing states no compensation. */
export function formatSalary(job: {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
}): string | null {
  if (!job.salaryMin && !job.salaryMax) {
    return null;
  }

  const currency = job.salaryCurrency ?? 'USD';
  const suffix = job.salaryPeriod ? PERIOD_SUFFIX[job.salaryPeriod] : '';
  const format = (value: number): string => {
    const compact =
      value >= 10_000
        ? `${Math.round(value / 1000)}k`
        : value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return `${currencySymbol(currency)}${compact}`;
  };

  if (job.salaryMin && job.salaryMax && job.salaryMin !== job.salaryMax) {
    return `${format(job.salaryMin)} – ${format(job.salaryMax)}${suffix}`;
  }
  return `${format(job.salaryMax ?? (job.salaryMin as number))}${suffix}`;
}

function currencySymbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'INR':
      return '₹';
    default:
      return `${currency} `;
  }
}

/** "just now", "3h ago", "5d ago", or an absolute date beyond 30 days. */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) {
    return 'Unknown';
  }
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) {
    return 'Unknown';
  }

  const diffMinutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 30) return `${diffDays}d ago`;

  return new Date(iso).toLocaleDateString();
}

/** Turns an enum member into a human label: FULL_TIME -> "Full time". */
export function humanizeEnum(value?: string | null): string {
  if (!value) {
    return '';
  }
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
