/**
 * Prisma seed script. Run via `pnpm prisma:seed`.
 *
 * Phase 1: a verified demo user.
 * Phase 2: an admin user, subscription rows, the three ingestion sources
 *          (Greenhouse / Lever / RemoteOK), and a small set of demo jobs so the
 *          UI is usable before the first scrape completes.
 */
import { createHash } from 'node:crypto';
import {
  AuthProvider,
  ExperienceLevel,
  JobSourceType,
  JobStatus,
  JobType,
  PlanTier,
  PrismaClient,
  SalaryPeriod,
  SubscriptionStatus,
  UserRole,
  WorkLocationType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedUsers(): Promise<void> {
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@aicareer.dev' },
    update: {},
    create: {
      email: 'demo@aicareer.dev',
      passwordHash,
      name: 'Demo User',
      role: UserRole.USER,
      authProvider: AuthProvider.LOCAL,
      isEmailVerified: true,
      profile: {
        create: {
          headline: 'Aspiring Full Stack Developer',
          bio: 'Demo seeded profile for local development.',
          skills: ['TypeScript', 'React', 'Node.js'],
          yearsOfExperience: 2,
          preferredLocations: ['Remote'],
          preferredJobTypes: ['FULL_TIME'],
        },
      },
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@aicareer.dev' },
    update: { role: UserRole.ADMIN },
    create: {
      email: 'admin@aicareer.dev',
      passwordHash,
      name: 'Platform Admin',
      role: UserRole.ADMIN,
      authProvider: AuthProvider.LOCAL,
      isEmailVerified: true,
      profile: { create: { headline: 'Platform Administrator' } },
    },
  });

  // Demo user gets PREMIUM so every gated feature is explorable out of the box.
  await prisma.subscription.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      plan: PlanTier.PREMIUM,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    },
  });

  await prisma.subscription.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: { userId: adminUser.id, plan: PlanTier.FREE, status: SubscriptionStatus.ACTIVE },
  });

  console.log('Seeded users: demo@aicareer.dev (PREMIUM), admin@aicareer.dev (ADMIN)');
}

async function seedJobSources(): Promise<void> {
  const sources = [
    {
      slug: 'greenhouse',
      name: 'Greenhouse Job Boards',
      type: JobSourceType.GREENHOUSE,
      cronExpression: '0 */6 * * *',
      requestsPerMinute: 30,
      priority: 10,
      // Public boards with stable slugs; extend or replace freely.
      config: {
        boards: [
          { slug: 'stripe', name: 'Stripe' },
          { slug: 'figma', name: 'Figma' },
          { slug: 'discord', name: 'Discord' },
        ],
      },
    },
    {
      slug: 'lever',
      name: 'Lever Postings',
      type: JobSourceType.LEVER,
      cronExpression: '30 */6 * * *',
      requestsPerMinute: 30,
      priority: 8,
      config: {
        companies: [
          { slug: 'netflix', name: 'Netflix' },
          { slug: 'ramp', name: 'Ramp' },
        ],
      },
    },
    {
      slug: 'remoteok',
      name: 'RemoteOK',
      type: JobSourceType.REMOTEOK,
      cronExpression: '0 */4 * * *',
      requestsPerMinute: 10,
      priority: 6,
      config: { url: 'https://remoteok.com/api', maxJobs: 300 },
    },
    // --- JobSpy sidecar boards (services/jobspy) ------------------------------
    // Disabled by default: they need the Python service running, and LinkedIn /
    // Glassdoor additionally need JOBSPY_PROXIES to avoid immediate 429s.
    // Enable per board from Admin → Scraper sources once the sidecar is up.
    // Cron times are staggered so the four boards never scrape concurrently.
    {
      slug: 'indeed',
      name: 'Indeed (JobSpy)',
      type: JobSourceType.INDEED,
      cronExpression: '0 */6 * * *',
      requestsPerMinute: 10,
      priority: 9,
      isEnabled: true,
      config: {
        searchTerms: ['software engineer', 'backend engineer'],
        location: 'New York, NY',
        resultsWanted: 50,
        countryIndeed: 'USA',
      },
    },
    {
      slug: 'linkedin',
      name: 'LinkedIn (JobSpy)',
      type: JobSourceType.LINKEDIN,
      cronExpression: '15 */12 * * *',
      // LinkedIn is the most aggressive blocker of the four.
      requestsPerMinute: 5,
      priority: 7,
      isEnabled: false,
      config: {
        searchTerms: ['software engineer'],
        location: 'New York, NY',
        resultsWanted: 25,
      },
    },
    {
      slug: 'glassdoor',
      name: 'Glassdoor (JobSpy)',
      type: JobSourceType.GLASSDOOR,
      cronExpression: '30 */12 * * *',
      requestsPerMinute: 5,
      priority: 5,
      isEnabled: false,
      config: {
        searchTerms: ['software engineer'],
        location: 'New York, NY',
        resultsWanted: 25,
        countryIndeed: 'USA',
      },
    },
    {
      slug: 'ziprecruiter',
      name: 'ZipRecruiter (JobSpy)',
      type: JobSourceType.ZIPRECRUITER,
      cronExpression: '45 */12 * * *',
      requestsPerMinute: 5,
      priority: 4,
      isEnabled: false,
      config: {
        searchTerms: ['software engineer'],
        // ZipRecruiter only covers US/Canada.
        location: 'New York, NY',
        resultsWanted: 25,
      },
    },
  ];

  for (const source of sources) {
    await prisma.jobSource.upsert({
      where: { slug: source.slug },
      // Config/cron are operator-owned once created, so re-seeding won't clobber them.
      update: { name: source.name, type: source.type },
      create: source,
    });
  }

  console.log(`Seeded ${sources.length} job sources`);
}

interface DemoJobInput {
  title: string;
  companyName: string;
  companySlug: string;
  description: string;
  location: string;
  city: string | null;
  country: string | null;
  isRemote: boolean;
  workModel: WorkLocationType;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  minYearsExperience: number;
  skills: string[];
  benefits: string[];
  salaryMin: number;
  salaryMax: number;
}

const DEMO_JOBS: DemoJobInput[] = [
  {
    title: 'Senior Frontend Engineer',
    companyName: 'Northwind Labs',
    companySlug: 'northwind-labs',
    description:
      'We are looking for a Senior Frontend Engineer to lead our design system work. You will build accessible React components, own the Next.js app architecture, and mentor mid-level engineers. Requires 5+ years of experience with TypeScript and React. Health insurance, equity, and a learning budget included.',
    location: 'Remote — Europe',
    city: null,
    country: 'Germany',
    isRemote: true,
    workModel: WorkLocationType.REMOTE,
    jobType: JobType.FULL_TIME,
    experienceLevel: ExperienceLevel.SENIOR,
    minYearsExperience: 5,
    skills: ['TypeScript', 'React', 'Next.js', 'Tailwind CSS', 'GraphQL'],
    benefits: ['Health insurance', 'Equity', 'Learning budget', 'Remote work'],
    salaryMin: 95_000,
    salaryMax: 130_000,
  },
  {
    title: 'Backend Engineer (Node.js)',
    companyName: 'Vertex Payments',
    companySlug: 'vertex-payments',
    description:
      'Join the payments platform team to build resilient APIs with NestJS, PostgreSQL, and Redis. You will design event-driven workflows with BullMQ, own service reliability, and work closely with product. 3+ years of experience with Node.js required. Hybrid schedule from our Berlin office.',
    location: 'Berlin, Germany',
    city: 'Berlin',
    country: 'Germany',
    isRemote: false,
    workModel: WorkLocationType.HYBRID,
    jobType: JobType.FULL_TIME,
    experienceLevel: ExperienceLevel.MID,
    minYearsExperience: 3,
    skills: ['Node.js', 'NestJS', 'PostgreSQL', 'Redis', 'Docker'],
    benefits: ['Health insurance', 'Flexible hours', 'Paid time off'],
    salaryMin: 70_000,
    salaryMax: 90_000,
  },
  {
    title: 'Junior Data Analyst',
    companyName: 'Bright Metrics',
    companySlug: 'bright-metrics',
    description:
      'Entry-level analyst role supporting the growth team. You will build dashboards in Power BI, write SQL against our Snowflake warehouse, and turn product data into weekly insights. 1+ years of experience or a strong internship background. We offer visa sponsorship for the right candidate.',
    location: 'Austin, TX',
    city: 'Austin',
    country: 'United States',
    isRemote: false,
    workModel: WorkLocationType.ONSITE,
    jobType: JobType.FULL_TIME,
    experienceLevel: ExperienceLevel.JUNIOR,
    minYearsExperience: 1,
    skills: ['SQL', 'Power BI', 'Snowflake', 'Excel', 'Python'],
    benefits: ['Health insurance', '401(k)', 'Visa sponsorship'],
    salaryMin: 65_000,
    salaryMax: 80_000,
  },
  {
    title: 'DevOps Engineer',
    companyName: 'Cloudpeak',
    companySlug: 'cloudpeak',
    description:
      'Own our Kubernetes platform end to end: Terraform modules, GitHub Actions pipelines, observability, and cost control across AWS. You will partner with product teams to make deployments boring. 4+ years of experience in infrastructure roles. Fully remote with a home office budget.',
    location: 'Remote',
    city: null,
    country: null,
    isRemote: true,
    workModel: WorkLocationType.REMOTE,
    jobType: JobType.FULL_TIME,
    experienceLevel: ExperienceLevel.SENIOR,
    minYearsExperience: 4,
    skills: ['Kubernetes', 'Terraform', 'AWS', 'Docker', 'CI/CD', 'Linux'],
    benefits: ['Remote work', 'Home office budget', 'Equity'],
    salaryMin: 110_000,
    salaryMax: 150_000,
  },
  {
    title: 'Product Design Intern',
    companyName: 'Northwind Labs',
    companySlug: 'northwind-labs',
    description:
      'Six-month internship on our product design team. You will run usability sessions, prototype in Figma, and ship real features alongside engineers. No prior industry experience required — a portfolio matters more than a CV. Mentorship and a learning stipend provided.',
    location: 'London, United Kingdom',
    city: 'London',
    country: 'United Kingdom',
    isRemote: false,
    workModel: WorkLocationType.ONSITE,
    jobType: JobType.INTERNSHIP,
    experienceLevel: ExperienceLevel.INTERNSHIP,
    minYearsExperience: 0,
    skills: ['Figma'],
    benefits: ['Learning budget', 'Flexible hours'],
    salaryMin: 2_400,
    salaryMax: 2_800,
  },
];

async function seedDemoJobs(): Promise<void> {
  for (const [index, job] of DEMO_JOBS.entries()) {
    const company = await prisma.company.upsert({
      where: { slug: job.companySlug },
      update: {},
      create: {
        slug: job.companySlug,
        name: job.companyName,
        industry: 'Technology',
        description: `${job.companyName} is a seeded demo company used for local development.`,
        isVerified: true,
      },
    });

    const dedupeKey = createHash('sha256')
      .update(`${job.companySlug}|${job.title.toLowerCase()}|${job.city ?? 'remote'}`)
      .digest('hex')
      .slice(0, 40);

    const postedAt = new Date(Date.now() - index * 12 * 3600 * 1000);

    await prisma.job.upsert({
      where: { dedupeKey },
      update: { lastSeenAt: new Date() },
      create: {
        slug: `${job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${job.companySlug}-${dedupeKey.slice(0, 8)}`,
        title: job.title,
        description: job.description,
        companyId: company.id,
        externalUrl: `https://example.com/jobs/${dedupeKey.slice(0, 8)}`,
        applyUrl: `https://example.com/jobs/${dedupeKey.slice(0, 8)}/apply`,
        location: job.location,
        city: job.city,
        country: job.country,
        isRemote: job.isRemote,
        workModel: job.workModel,
        jobType: job.jobType,
        experienceLevel: job.experienceLevel,
        minYearsExperience: job.minYearsExperience,
        skills: job.skills,
        benefits: job.benefits,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: 'USD',
        salaryPeriod:
          job.jobType === JobType.INTERNSHIP ? SalaryPeriod.MONTHLY : SalaryPeriod.YEARLY,
        visaSponsorship: job.benefits.includes('Visa sponsorship') ? true : null,
        status: JobStatus.ACTIVE,
        postedAt,
        // Seeded jobs are immediately visible to every plan.
        earlyAccessUntil: null,
        contentHash: createHash('sha256').update(job.description).digest('hex'),
        dedupeKey,
      },
    });
  }

  console.log(`Seeded ${DEMO_JOBS.length} demo jobs`);
}

async function main(): Promise<void> {
  await seedUsers();
  await seedJobSources();
  await seedDemoJobs();
  console.log('\nDemo login: demo@aicareer.dev / Password123!  (Premium plan)');
  console.log('Admin login: admin@aicareer.dev / Password123!');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
