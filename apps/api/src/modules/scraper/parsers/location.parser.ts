import { WorkLocationType } from '@ai-career/shared';
import { normalizeWhitespace } from './text.util';

export interface ParsedLocation {
  location: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  isRemote: boolean;
  workModel: WorkLocationType | null;
}

const REMOTE_PATTERN = /\b(remote|work from home|wfh|distributed|anywhere)\b/i;
const HYBRID_PATTERN = /\bhybrid\b/i;
const ONSITE_PATTERN = /\b(on-?site|in-?office|in-?person)\b/i;

/** US state abbreviations, so "Austin, TX" resolves to a country instead of a region-only row. */
const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA',
  'RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]);

const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'United States',
  us: 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  'united states of america': 'United States',
  uk: 'United Kingdom',
  'u.k.': 'United Kingdom',
  england: 'United Kingdom',
  deutschland: 'Germany',
  nederland: 'Netherlands',
  holland: 'Netherlands',
};

/**
 * Normalizes free-form location strings ("Remote - US", "Austin, TX",
 * "London, United Kingdom", "Berlin (Hybrid)") into structured parts plus a
 * work-model classification.
 */
export function parseLocation(
  raw?: string | null,
  hints: { isRemote?: boolean | null; workplaceType?: string | null; description?: string | null } = {},
): ParsedLocation {
  const text = raw ? normalizeWhitespace(raw) : '';
  const workplaceHint = hints.workplaceType?.toLowerCase() ?? '';

  const remoteFromHint = hints.isRemote === true || workplaceHint.includes('remote');
  const hybridFromHint = workplaceHint.includes('hybrid') || HYBRID_PATTERN.test(text);
  const onsiteFromHint = ONSITE_PATTERN.test(workplaceHint);

  const isRemote = remoteFromHint || REMOTE_PATTERN.test(text);

  let workModel: WorkLocationType | null = null;
  if (hybridFromHint) {
    workModel = WorkLocationType.HYBRID;
  } else if (isRemote) {
    workModel = WorkLocationType.REMOTE;
  } else if (onsiteFromHint || ONSITE_PATTERN.test(text) || text.length > 0) {
    workModel = WorkLocationType.ONSITE;
  }

  // Drop remote/hybrid qualifiers so only the geography remains for parsing.
  const geographic = text
    .replace(/\((?:[^)]*)(remote|hybrid|on-?site)(?:[^)]*)\)/gi, ' ')
    .replace(/\b(fully|100%)\s+remote\b/gi, ' ')
    .replace(/\bremote\b/gi, ' ')
    .replace(/\bhybrid\b/gi, ' ')
    .replace(/\bon-?site\b/gi, ' ')
    .replace(/^[\s,;:/|–—-]+|[\s,;:/|–—-]+$/g, '')
    .trim();

  const parts = geographic
    .split(/[,|]/)
    .map((part) => normalizeWhitespace(part))
    .filter((part) => part.length > 0 && !/^(and|or|\/)$/i.test(part));

  let city: string | null = null;
  let region: string | null = null;
  let country: string | null = null;

  if (parts.length === 1) {
    const single = parts[0];
    country = resolveCountry(single) ?? null;
    if (!country) {
      city = single;
    }
  } else if (parts.length >= 2) {
    city = parts[0];
    const tail = parts[parts.length - 1];
    const middle = parts.length >= 3 ? parts[parts.length - 2] : parts[1];

    const tailCountry = resolveCountry(tail);
    if (tailCountry) {
      country = tailCountry;
      region = middle !== tail ? middle : null;
    } else if (US_STATES.has(tail.toUpperCase())) {
      region = tail.toUpperCase();
      country = 'United States';
    } else {
      region = tail;
    }
  }

  const label = text.length > 0 ? text : isRemote ? 'Remote' : null;

  return {
    location: label,
    city: city && city.length <= 80 ? city : null,
    region,
    country,
    isRemote,
    workModel,
  };
}

function resolveCountry(value: string): string | null {
  const key = value.trim().toLowerCase();
  if (COUNTRY_ALIASES[key]) {
    return COUNTRY_ALIASES[key];
  }
  // Multi-word, title-cased tails are usually country names ("United Kingdom").
  if (/^[a-z\s.'-]{4,}$/i.test(value) && value.includes(' ')) {
    return normalizeWhitespace(value);
  }
  const KNOWN = [
    'Germany','France','Spain','Portugal','Italy','Poland','Canada','Mexico','Brazil','India',
    'Australia','Japan','Singapore','Ireland','Netherlands','Belgium','Sweden','Norway','Denmark',
    'Finland','Switzerland','Austria','Israel','Argentina','Chile','Colombia','Nigeria','Kenya',
    'Egypt','Turkey','Ukraine','Romania','Greece','Czechia','Hungary','Estonia','Latvia','Lithuania',
  ];
  const match = KNOWN.find((country) => country.toLowerCase() === key);
  return match ?? null;
}
