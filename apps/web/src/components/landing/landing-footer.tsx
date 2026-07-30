import Link from 'next/link';
import { Github, Linkedin, Sparkles, Twitter } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const FOOTER_COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Job search', href: '/jobs' },
      { label: 'AI evaluations', href: '/dashboard/evaluations' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'How it works', href: '/#how-it-works' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Career guides', href: '/#resources' },
      { label: 'Scoring rubric', href: '/#how-scoring-works' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Create account', href: '/register' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
];

const SOCIAL_LINKS = [
  { label: 'GitHub', href: 'https://github.com', icon: Github },
  { label: 'X (Twitter)', href: 'https://twitter.com', icon: Twitter },
  { label: 'LinkedIn', href: 'https://linkedin.com', icon: Linkedin },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/20">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
              AI Career Platform
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              AI-powered job matching, resume tailoring and application tracking — bring your own
              key, or let us manage it.
            </p>

            <div className="mt-5 flex items-center gap-2">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={social.label}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <social.icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="text-sm font-semibold">{column.heading}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} AI Career Platform. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
