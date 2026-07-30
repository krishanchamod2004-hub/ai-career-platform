import { ArrowRight, KeyRound, ScanSearch, Target } from 'lucide-react';
import { Reveal, Section, SectionHeading, StaggerGroup, StaggerItem } from '@/components/landing/motion-primitives';

const ARTICLES = [
  {
    icon: ScanSearch,
    title: 'How to Bypass ATS Filters in 2026 Using Targeted Keywords',
    excerpt:
      'Applicant tracking systems reject qualified candidates over keyword mismatches. Here is how to audit and fix that before you hit submit.',
    readTime: '7 min read',
  },
  {
    icon: KeyRound,
    title: 'Why Bring Your Own Key (BYOK) Makes AI Job Search 100% Free for Users',
    excerpt:
      'Running evaluations on your own Anthropic or OpenAI key means no subscription markup on tokens you are already paying for.',
    readTime: '5 min read',
  },
  {
    icon: Target,
    title: 'The A–F Scoring Method: How to Focus Only on High-Match Job Listings',
    excerpt:
      'Applying to everything is a losing strategy. Here is how a weighted rubric turns 200 listings into the 10 worth your time.',
    readTime: '6 min read',
  },
];

export function ResourcesSection() {
  return (
    <Section id="resources" className="bg-muted/20">
      <SectionHeading
        eyebrow="Resources"
        title="Career guides worth your time"
        description="Practical, specific advice — not generic “tailor your resume” platitudes."
      />

      <StaggerGroup className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ARTICLES.map((article) => (
          <StaggerItem key={article.title}>
            <article className="glass-card group flex h-full flex-col overflow-hidden rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <article.icon className="h-5 w-5" aria-hidden="true" />
              </span>

              <h3 className="mt-4 text-base font-semibold leading-snug">{article.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{article.excerpt}</p>

              <div className="mt-5 flex items-center justify-between border-t border-border/50 pt-4 text-xs text-muted-foreground">
                <span>{article.readTime}</span>
                <a
                  href="#"
                  className="inline-flex items-center gap-1 font-medium text-primary transition-transform group-hover:translate-x-0.5"
                >
                  Read more
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </article>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <Reveal delay={0.3} className="mt-10 text-center">
        <p className="text-sm text-muted-foreground">
          More guides land in your dashboard every week — no separate blog subscription required.
        </p>
      </Reveal>
    </Section>
  );
}
