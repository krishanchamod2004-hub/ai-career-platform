/**
 * Small, dependency-free text helpers shared by the parsers.
 * A full HTML parser (cheerio/jsdom) is overkill here: source descriptions are
 * simple markup, and keeping this pure makes it trivial to unit test.
 */

const BLOCK_TAGS = /<\/?(p|div|br|li|ul|ol|tr|h[1-6]|section|article|table)[^>]*>/gi;
/** Inline tags are dropped without inserting whitespace ("<strong>APIs</strong>." -> "APIs."). */
const INLINE_TAGS = /<\/?(strong|b|em|i|span|a|code|u|small|sup|sub|mark|abbr)[^>]*>/gi;

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(INLINE_TAGS, '')
      // Preserve list/paragraph boundaries as newlines before dropping all tags.
      .replace(/<\/(p|div|li|ul|ol|tr|h[1-6]|section|article)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(BLOCK_TAGS, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    // Collapse the blank lines that tag boundaries inevitably produce.
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

export function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#(\d+);/g, (_match, code: string) => safeCharFromCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code: string) =>
      safeCharFromCode(parseInt(code, 16)),
    );
}

function safeCharFromCode(code: number): string {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

/** URL-safe slug. Non-latin scripts fall back to a hash-suffixed placeholder upstream. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Canonical form used for company matching and dedupe fingerprints:
 * lowercase, no punctuation, no legal suffixes ("Inc", "GmbH", ...).
 */
export function canonicalizeCompanyName(name: string): string {
  return normalizeWhitespace(
    name
      .toLowerCase()
      .replace(/[.,]/g, ' ')
      .replace(/\b(inc|llc|ltd|limited|gmbh|bv|nv|sarl|sas|ag|ab|oy|plc|corp|corporation|co|company|holdings|group|technologies|technology|labs|inc\.)\b/g, ' ')
      .replace(/[^a-z0-9\s&+-]/g, ' '),
  );
}

/** Strips tracking/referral query parameters so the same posting yields one URL. */
export function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const strip = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'referrer',
      'source',
      'gh_src',
      'lever-source',
    ];
    strip.forEach((param) => parsed.searchParams.delete(param));
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}
