import type { Metadata } from 'next';
import { JobStatus } from '@ai-career/shared';
import { JobDetailClient } from './job-detail-client';
import { fetchJobServerSide } from '@/lib/jobs-server';
import { buildJobPostingJsonLd } from '@/lib/json-ld';
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/lib/site-config';

interface JobDetailPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: JobDetailPageProps): Promise<Metadata> {
  const job = await fetchJobServerSide(params.id);

  if (!job) {
    return {
      title: 'Job unavailable',
      description: 'This listing may have expired or is restricted to a higher plan.',
    };
  }

  const companyName = job.company?.name ?? 'a growing company';
  // No manual "| AI Career Platform" suffix here — the root layout's title
  // template (`%s | AI Career Platform`) already appends it; adding it twice
  // would render "... | AI Career Platform | AI Career Platform".
  const title = `${job.title} at ${companyName}`;
  const locationPart = job.isRemote ? 'Remote' : job.location ?? 'various locations';
  const description = `${job.title} at ${companyName} — ${locationPart}. Apply directly or get an AI-graded fit score before you apply on ${SITE_NAME}.`;
  const url = `${SITE_URL}/jobs/${job.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      images: [{ url: job.company?.logoUrl ?? DEFAULT_OG_IMAGE }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [job.company?.logoUrl ?? DEFAULT_OG_IMAGE],
    },
    robots:
      job.status === JobStatus.ACTIVE
        ? { index: true, follow: true }
        : { index: false, follow: true },
  };
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const job = await fetchJobServerSide(params.id);

  return (
    <>
      {job ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJobPostingJsonLd(job)) }}
        />
      ) : null}
      <JobDetailClient idOrSlug={params.id} initialJob={job ?? undefined} />
    </>
  );
}
