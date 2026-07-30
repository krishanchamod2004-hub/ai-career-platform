import {
  Briefcase,
  Building,
  Building2,
  Globe2,
  Search,
  ShieldCheck,
  Sprout,
} from 'lucide-react';
import { Marquee } from '@/components/landing/marquee';
import { Reveal } from '@/components/landing/motion-primitives';

/**
 * Job boards the scraper ingests from.
 *
 * No third-party brand marks are bundled (avoids logo-usage/licensing issues on
 * a marketing page); each board gets a distinct Lucide icon plus its name so the
 * badge still reads as "this specific board" rather than a generic pill.
 */
const JOB_BOARDS = [
  { name: 'LinkedIn', icon: Briefcase },
  { name: 'Indeed', icon: Search },
  { name: 'Glassdoor', icon: Building },
  { name: 'ZipRecruiter', icon: ShieldCheck },
  { name: 'RemoteOK', icon: Globe2 },
  { name: 'Greenhouse', icon: Sprout },
  { name: 'Lever', icon: Building2 },
] as const;

export function LogoCloudSection() {
  return (
    <div className="relative border-y border-border/60 bg-muted/30 py-12">
      <Reveal className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Scraping &amp; auto-matching across major job boards
        </p>
      </Reveal>

      <div className="mt-8">
        <Marquee durationSeconds={30}>
          {JOB_BOARDS.map((board) => (
            <div
              key={board.name}
              className="glass-card flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-foreground/80"
            >
              <board.icon className="h-4 w-4 text-primary" aria-hidden="true" />
              {board.name}
            </div>
          ))}
        </Marquee>
      </div>
    </div>
  );
}
