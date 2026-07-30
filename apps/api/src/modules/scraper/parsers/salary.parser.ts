import { SalaryPeriod } from '@ai-career/shared';

export interface ParsedSalary {
  min: number | null;
  max: number | null;
  currency: string | null;
  period: SalaryPeriod | null;
}

const SYMBOL_CURRENCIES: Array<[RegExp, string]> = [
  [/c\$/i, 'CAD'],
  [/a\$/i, 'AUD'],
  [/us\$|\$/, 'USD'],
  [/€/, 'EUR'],
  [/£/, 'GBP'],
  [/₹/, 'INR'],
  [/¥/, 'JPY'],
  [/zł/i, 'PLN'],
];

const CODE_CURRENCY =
  /\b(USD|EUR|GBP|INR|CAD|AUD|JPY|CHF|SEK|NOK|DKK|PLN|BRL|MXN|SGD|NZD|ZAR|AED)\b/i;

/** Plausibility bounds per period — filters out years, headcounts, and IDs. */
const RANGE_BY_PERIOD: Record<SalaryPeriod, { min: number; max: number }> = {
  [SalaryPeriod.HOURLY]: { min: 3, max: 1_000 },
  [SalaryPeriod.DAILY]: { min: 40, max: 10_000 },
  [SalaryPeriod.WEEKLY]: { min: 200, max: 50_000 },
  [SalaryPeriod.MONTHLY]: { min: 300, max: 200_000 },
  [SalaryPeriod.YEARLY]: { min: 8_000, max: 2_000_000 },
};

/**
 * Extracts a salary range from free-form compensation text.
 *
 * Handles the formats real job boards emit: "$120,000 - $150,000 a year",
 * "120k–150k USD", "€60.000", "£45,000 per annum", "$55/hr".
 * Returns nulls rather than guesses when the text is not a compensation string.
 */
export function parseSalaryText(input?: string | null): ParsedSalary {
  const empty: ParsedSalary = { min: null, max: null, currency: null, period: null };
  if (!input) {
    return empty;
  }

  const text = input.replace(/\u2013|\u2014|\u2212/g, '-');
  const lower = text.toLowerCase();
  const amounts = extractAmounts(text);
  if (amounts.length === 0) {
    return empty;
  }

  const currency = detectCurrency(text);
  const { period, explicit } = detectPeriod(lower, amounts);

  // Bare numbers with neither a currency nor a pay-period keyword are almost
  // always something else (headcount, founding year, ...), so they are ignored.
  if (!currency && !explicit) {
    return empty;
  }

  const bounds = RANGE_BY_PERIOD[period];
  const plausible = amounts.filter((value) => value >= bounds.min && value <= bounds.max);
  if (plausible.length === 0) {
    return { ...empty, currency };
  }

  const min = Math.min(...plausible);
  const max = Math.max(...plausible);

  return {
    min: Math.round(min),
    max: plausible.length > 1 ? Math.round(max) : null,
    currency,
    period,
  };
}

/**
 * Reconciles explicit numeric fields from an adapter with any free-text salary.
 * Structured values always win; text only fills the gaps.
 */
export function resolveSalary(params: {
  min?: number | null;
  max?: number | null;
  currency?: string | null;
  text?: string | null;
  interval?: string | null;
}): ParsedSalary & { text: string | null } {
  const fromText = parseSalaryText(params.text);
  const hasStructured = Boolean(params.min || params.max);

  let min = params.min ?? fromText.min;
  let max = params.max ?? fromText.max;

  if (min !== null && max !== null && min > max) {
    [min, max] = [max, min];
  }

  const period = hasStructured
    ? (normalizeInterval(params.interval) ?? inferPeriodFromAmount(min ?? max))
    : (fromText.period ?? inferPeriodFromAmount(min ?? max));

  return {
    min: min ?? null,
    max: max ?? null,
    currency: (params.currency ?? fromText.currency)?.toUpperCase() ?? null,
    period,
    text: params.text ? params.text.trim().slice(0, 120) : null,
  };
}

function extractAmounts(text: string): number[] {
  const amounts: number[] = [];
  const pattern = /(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:\.\d+)?)\s*([kK])?/g;

  let match: RegExpExecArray | null = pattern.exec(text);
  while (match !== null) {
    const [, rawNumber, kSuffix] = match;
    const groupedThousands = /^\d{1,3}([.,]\d{3})+$/.test(rawNumber);
    const normalized = groupedThousands
      ? rawNumber.replace(/[.,]/g, '')
      : rawNumber.replace(/,/g, '');

    let value = Number(normalized);
    if (Number.isFinite(value)) {
      if (kSuffix) {
        value *= 1_000;
      }
      amounts.push(value);
    }
    match = pattern.exec(text);
  }

  return amounts;
}

function detectCurrency(text: string): string | null {
  const codeMatch = text.match(CODE_CURRENCY);
  if (codeMatch) {
    return codeMatch[1].toUpperCase();
  }
  for (const [pattern, currency] of SYMBOL_CURRENCIES) {
    if (pattern.test(text)) {
      return currency;
    }
  }
  return null;
}

function detectPeriod(
  lowerText: string,
  amounts: number[],
): { period: SalaryPeriod; explicit: boolean } {
  if (/(per|an|\/)\s*(hour|hr)\b|hourly|\/hr|p\/h\b/.test(lowerText)) {
    return { period: SalaryPeriod.HOURLY, explicit: true };
  }
  if (/(per|a|\/)\s*day\b|daily|\/day/.test(lowerText)) {
    return { period: SalaryPeriod.DAILY, explicit: true };
  }
  if (/(per|a|\/)\s*week\b|weekly|\/wk/.test(lowerText)) {
    return { period: SalaryPeriod.WEEKLY, explicit: true };
  }
  if (/(per|a|\/)\s*month\b|monthly|\/mo\b|p\/m\b/.test(lowerText)) {
    return { period: SalaryPeriod.MONTHLY, explicit: true };
  }
  if (/(per|a|\/)\s*(year|annum)\b|yearly|annually|\/yr|pa\b|pro jahr/.test(lowerText)) {
    return { period: SalaryPeriod.YEARLY, explicit: true };
  }
  return { period: inferPeriodFromAmount(Math.max(...amounts)), explicit: false };
}

function inferPeriodFromAmount(amount?: number | null): SalaryPeriod {
  if (!amount) {
    return SalaryPeriod.YEARLY;
  }
  if (amount <= 500) {
    return SalaryPeriod.HOURLY;
  }
  if (amount < 8_000) {
    return SalaryPeriod.MONTHLY;
  }
  return SalaryPeriod.YEARLY;
}

function normalizeInterval(interval?: string | null): SalaryPeriod | null {
  if (!interval) {
    return null;
  }
  const value = interval.toLowerCase();
  if (value.includes('hour')) return SalaryPeriod.HOURLY;
  if (value.includes('day')) return SalaryPeriod.DAILY;
  if (value.includes('week')) return SalaryPeriod.WEEKLY;
  if (value.includes('month')) return SalaryPeriod.MONTHLY;
  if (value.includes('year') || value.includes('annual')) return SalaryPeriod.YEARLY;
  return null;
}
