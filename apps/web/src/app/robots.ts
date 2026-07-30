import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-config';

/**
 * Allows crawling of all public pages; disallows the authenticated dashboard
 * and auth flows, which have no SEO value and would otherwise waste crawl
 * budget on pages that just redirect to /login for an unauthenticated crawler.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/verify-email',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
