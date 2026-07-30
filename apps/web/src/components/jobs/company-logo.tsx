'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface CompanyLogoSource {
  /** Company's own logo URL, as stored (scraped or admin-set). */
  logoUrl?: string | null;
  /** Real website, when known — preferred over guessing a domain from the name. */
  websiteUrl?: string | null;
  name: string;
}

interface CompanyLogoProps extends CompanyLogoSource {
  className?: string;
  /** Pixel size for both dimensions (component is always square). */
  size?: number;
}

/**
 * Derives a bare domain (no protocol/path) from a real website URL.
 * Returns null for anything that doesn't parse — callers fall through to the
 * name-guessed domain rather than trusting a malformed value.
 */
function domainFromWebsite(websiteUrl: string): string | null {
  try {
    const url = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
    return url.hostname.replace(/^www\./, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Best-effort domain guess from a company name (e.g. "Stripe, Inc." -> "stripe.com").
 * This is a GUESS, not a verified domain — it exists only as a logo lookup key
 * for third-party avatar services, and is never persisted to the database
 * because a wrong guess would otherwise look like confirmed data forever.
 */
function domainFromName(name: string): string | null {
  const cleaned = name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|group|holdings)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  return cleaned.length > 0 ? `${cleaned}.com` : null;
}

/** Small deterministic hash so the same company always gets the same avatar color. */
function hashToHue(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

/** Ordered fallback chain of image URLs to attempt before giving up on a real logo. */
function buildCandidateUrls({ logoUrl, websiteUrl, name }: CompanyLogoSource): string[] {
  const candidates: string[] = [];
  const realDomain = websiteUrl ? domainFromWebsite(websiteUrl) : null;
  const guessedDomain = realDomain ? null : domainFromName(name);
  const domain = realDomain ?? guessedDomain;

  if (logoUrl) {
    candidates.push(logoUrl);
  }
  if (domain) {
    candidates.push(`https://logo.clearbit.com/${domain}`);
    candidates.push(`https://unavatar.io/${domain}`);
  }
  return candidates;
}

/**
 * Renders a company logo with automatic fallback:
 *   1. The stored `logoUrl`, if present.
 *   2. Clearbit, keyed by the real domain (from `websiteUrl`) when known, or a
 *      best-effort domain guessed from the company name otherwise.
 *   3. unavatar.io on the same domain.
 *   4. A styled initial-letter avatar, colored deterministically per company —
 *      the terminal fallback; it never fails, so the chain always ends cleanly.
 *
 * Each candidate is only attempted after the previous one's `onError` fires, so
 * a slow or dead third-party service never blocks the others.
 */
export function CompanyLogo({ logoUrl, websiteUrl, name, className, size = 44 }: CompanyLogoProps) {
  const candidates = React.useMemo(
    () => buildCandidateUrls({ logoUrl, websiteUrl, name }),
    [logoUrl, websiteUrl, name],
  );
  const [attemptIndex, setAttemptIndex] = React.useState(0);

  // New job/company -> restart the fallback chain instead of keeping a stale index.
  React.useEffect(() => {
    setAttemptIndex(0);
  }, [candidates]);

  const currentSrc = candidates[attemptIndex];
  const exhausted = currentSrc === undefined;

  if (exhausted) {
    const initial = name.trim().charAt(0).toUpperCase() || '?';
    const hue = hashToHue(name.trim().toLowerCase() || 'unknown');
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-lg border font-semibold',
          className,
        )}
        style={{
          width: size,
          height: size,
          backgroundColor: `hsl(${hue} 70% 92%)`,
          color: `hsl(${hue} 45% 32%)`,
          fontSize: size * 0.4,
        }}
        role="img"
        aria-label={`${name} logo`}
      >
        {initial}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={currentSrc}
        src={currentSrc}
        alt={`${name} logo`}
        className="h-full w-full object-contain"
        loading="lazy"
        onError={() => setAttemptIndex((index) => index + 1)}
      />
    </div>
  );
}
