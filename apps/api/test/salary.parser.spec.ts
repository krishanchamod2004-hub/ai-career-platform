import { SalaryPeriod } from '@ai-career/shared';
import { parseSalaryText, resolveSalary } from '../src/modules/scraper/parsers/salary.parser';

describe('parseSalaryText', () => {
  it('parses a US annual range with thousands separators', () => {
    expect(parseSalaryText('$120,000 - $150,000 a year')).toEqual({
      min: 120_000,
      max: 150_000,
      currency: 'USD',
      period: SalaryPeriod.YEARLY,
    });
  });

  it('expands k suffixes and reads the currency code', () => {
    expect(parseSalaryText('120k–150k USD per year')).toEqual({
      min: 120_000,
      max: 150_000,
      currency: 'USD',
      period: SalaryPeriod.YEARLY,
    });
  });

  it('handles European thousands separators and the euro symbol', () => {
    const result = parseSalaryText('€60.000 pro Jahr');
    expect(result.min).toBe(60_000);
    expect(result.currency).toBe('EUR');
  });

  it('detects hourly compensation', () => {
    expect(parseSalaryText('$55 - $70 per hour')).toEqual({
      min: 55,
      max: 70,
      currency: 'USD',
      period: SalaryPeriod.HOURLY,
    });
  });

  it('detects monthly compensation', () => {
    const result = parseSalaryText('£4,500 per month');
    expect(result.min).toBe(4_500);
    expect(result.period).toBe(SalaryPeriod.MONTHLY);
    expect(result.currency).toBe('GBP');
  });

  it('ignores bare numbers with no currency or pay period', () => {
    expect(parseSalaryText('We are a team of 200 people founded in 2011')).toEqual({
      min: null,
      max: null,
      currency: null,
      period: null,
    });
  });

  it('returns nulls for empty input', () => {
    expect(parseSalaryText(null)).toEqual({
      min: null,
      max: null,
      currency: null,
      period: null,
    });
  });

  it('rejects implausible yearly values', () => {
    // 2019 looks like a number but is far below any plausible annual salary.
    expect(parseSalaryText('Salary reviewed annually since 2019').min).toBeNull();
  });
});

describe('resolveSalary', () => {
  it('prefers structured values over free text', () => {
    const result = resolveSalary({
      min: 90_000,
      max: 110_000,
      currency: 'eur',
      text: '$1 - $2 per hour',
    });
    expect(result.min).toBe(90_000);
    expect(result.max).toBe(110_000);
    expect(result.currency).toBe('EUR');
    expect(result.period).toBe(SalaryPeriod.YEARLY);
  });

  it('swaps inverted bounds', () => {
    const result = resolveSalary({ min: 150_000, max: 100_000 });
    expect(result.min).toBe(100_000);
    expect(result.max).toBe(150_000);
  });

  it('falls back to parsing the text when no structured values exist', () => {
    const result = resolveSalary({ text: '$80,000 - $95,000 per year' });
    expect(result.min).toBe(80_000);
    expect(result.max).toBe(95_000);
  });

  it('honours an explicit interval hint', () => {
    const result = resolveSalary({ min: 60, max: 80, interval: 'per-hour' });
    expect(result.period).toBe(SalaryPeriod.HOURLY);
  });
});
