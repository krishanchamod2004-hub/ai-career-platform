'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal, Section, SectionHeading } from '@/components/landing/motion-primitives';

const FAQS = [
  {
    question: 'Is my data private?',
    answer:
      'Yes. Your resume and profile stay in your account. AI evaluations run with your own Anthropic or OpenAI key, sent directly to the vendor with each request — we never store the key, and job descriptions are only used to produce your grade, never to train a model.',
  },
  {
    question: 'How do I get a Claude or OpenAI API key?',
    answer:
      'Create one in the Anthropic console (console.anthropic.com) or the OpenAI platform dashboard (platform.openai.com) — both take under a minute. Paste it into the API-key modal in your dashboard; it is stored only in your browser session unless you choose to remember it.',
  },
  {
    question: 'Does JobSpy scrape in real time?',
    answer:
      'JobSpy runs on a schedule per source (typically every few hours) plus on-demand triggers, pulling from LinkedIn, Indeed, Glassdoor and ZipRecruiter. Results are deduplicated against Greenhouse, Lever and RemoteOK listings before they reach your feed, so you never see the same posting twice.',
  },
  {
    question: 'What happens if I switch from BYOK to a managed plan?',
    answer:
      'Nothing about your saved jobs, applications or alerts changes. You simply stop being prompted for an API key — evaluations continue to use the same rubric and produce the same grade format.',
  },
  {
    question: 'Can I re-run an evaluation if my resume changes?',
    answer:
      'Yes — re-evaluating overwrites the stored grade for that job. We cache the first result so browsing your matches never re-spends tokens by accident; re-running is always an explicit action.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <Section id="faq">
      <SectionHeading
        eyebrow="FAQ"
        title="Questions, answered"
        description="If something's still unclear, the dashboard has contextual help in every AI-powered section."
      />

      <Reveal delay={0.1} className="mx-auto mt-12 max-w-2xl divide-y divide-border/60">
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={faq.question}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${index}`}
                className="flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-medium transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {faq.question}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300',
                    isOpen && 'rotate-180 text-primary',
                  )}
                  aria-hidden="true"
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    id={`faq-panel-${index}`}
                    role="region"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="pb-5 text-sm leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </Reveal>
    </Section>
  );
}
