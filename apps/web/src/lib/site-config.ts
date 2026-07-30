/**
 * Central site-wide constants for SEO metadata, Open Graph, JSON-LD, sitemap
 * and robots.txt — kept in one place so title/description conventions and the
 * canonical origin can't drift between `layout.tsx`, individual pages, and the
 * sitemap/robots generators.
 */

/** Public origin of this app, no trailing slash. Baked in at build time. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export const SITE_NAME = 'AI Career Platform';

export const DEFAULT_TITLE = 'AI Career Platform | Smart Job Search & ATS Resume Optimizer';

export const DEFAULT_DESCRIPTION =
  'AI-powered career platform for automated job applications and remote tech jobs. ' +
  'Search an AI job search engine aggregating LinkedIn, Indeed, and Glassdoor, grade every ' +
  'listing with an ATS-friendly fit score, and accelerate your career with AI.';

export const TARGET_KEYWORDS = [
  'AI Job Search Engine',
  'ATS-Friendly Resume Builder',
  'Automated Job Applications',
  'Remote Tech Jobs',
  'AI Career Acceleration',
];

/**
 * Default social preview image. This is a placeholder SVG, not final brand
 * artwork — replace with a real designed 1200x630 PNG/JPG before launch.
 * Some crawlers (older LinkedIn/Facebook scrapers in particular) don't reliably
 * render SVG previews, so swap this for a rasterized image as soon as one exists.
 */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.svg`;

/**
 * No real X/Twitter handle exists yet anywhere in this codebase (the landing
 * footer links to a bare https://twitter.com placeholder too) — left unset
 * rather than fabricating one. Set this once a real handle exists; `twitter.site`
 * in layout.tsx is omitted while this is null.
 */
export const TWITTER_HANDLE: string | null = null;
