import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AiProvider,
  EVALUATION_CRITERIA,
  EvaluationGrade,
  UserRole,
  type AiCredentials,
} from '@ai-career/shared';
import { EvaluationsService } from '../src/modules/evaluations/evaluations.service';
import type { AiProviderRegistry } from '../src/modules/evaluations/ai/ai-provider.registry';
import type { AiCompletionRequest } from '../src/modules/evaluations/ai/ai-provider.interface';
import type { PrismaService } from '../src/modules/prisma/prisma.service';
import type { BillingService } from '../src/modules/billing/billing.service';
import type { AuthenticatedUser } from '../src/modules/auth/interfaces/jwt-payload.interface';

const USER: AuthenticatedUser = {
  id: 'user-1',
  email: 'demo@aicareer.dev',
  role: UserRole.USER,
};
const JOB_ID = 'job-1';
const CREDENTIALS: AiCredentials = {
  provider: AiProvider.ANTHROPIC,
  apiKey: 'sk-ant-api03-SUPERSECRETVALUE',
  model: 'claude-3-5-haiku-20241022',
};

function completionText(score = 4): string {
  return JSON.stringify({
    criteria: Object.fromEntries(
      EVALUATION_CRITERIA.map((criterion) => [criterion.key, { score, notes: 'because' }]),
    ),
    summary: 'Good fit overall.',
    strengths: ['TypeScript depth'],
    gaps: ['No Go experience'],
  });
}

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    title: 'Senior Engineer',
    description: 'Build things.',
    location: 'Remote',
    isRemote: true,
    workModel: 'REMOTE',
    jobType: 'FULL_TIME',
    experienceLevel: 'SENIOR',
    minYearsExperience: 5,
    skills: ['TypeScript'],
    benefits: [],
    salaryMin: 100_000,
    salaryMax: 140_000,
    salaryCurrency: 'USD',
    salaryPeriod: 'YEARLY',
    salaryText: null,
    visaSponsorship: null,
    earlyAccessUntil: null,
    company: { name: 'Acme' },
    ...overrides,
  };
}

function storedRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-07-28T00:00:00.000Z');
  return {
    id: 'eval-1',
    userId: USER.id,
    jobId: JOB_ID,
    score: 4,
    grade: EvaluationGrade.B,
    rubric: Object.fromEntries(
      EVALUATION_CRITERIA.map((criterion) => [
        criterion.key,
        { score: 4, weight: criterion.weight, notes: 'because' },
      ]),
    ),
    summary: 'Good fit overall.',
    strengths: ['TypeScript depth'],
    gaps: ['No Go experience'],
    provider: AiProvider.ANTHROPIC,
    model: 'claude-3-5-haiku-20241022',
    promptTokens: 900,
    completionTokens: 210,
    durationMs: 1234,
    createdAt: now,
    updatedAt: now,
    job: null,
    ...overrides,
  };
}

interface Harness {
  service: EvaluationsService;
  prisma: {
    job: { findUnique: jest.Mock };
    jobEvaluation: { findUnique: jest.Mock; upsert: jest.Mock };
    profile: { findUnique: jest.Mock };
  };
  complete: jest.Mock<Promise<unknown>, [AiCompletionRequest]>;
}

function createHarness(options: { existing?: unknown; job?: unknown } = {}): Harness {
  const complete = jest.fn(async (_request: AiCompletionRequest) => ({
    text: completionText(),
    // The vendor resolves the alias to a dated snapshot; that is what we store.
    model: 'claude-3-5-haiku-20241022',
    promptTokens: 900,
    completionTokens: 210,
  }));

  const prisma = {
    job: { findUnique: jest.fn(async () => options.job ?? jobRow()) },
    jobEvaluation: {
      findUnique: jest.fn(async () => options.existing ?? null),
      upsert: jest.fn(async (args: { create: Record<string, unknown> }) =>
        storedRow({ ...args.create, job: null }),
      ),
    },
    profile: {
      findUnique: jest.fn(async () => ({
        headline: 'Backend engineer',
        bio: null,
        skills: ['TypeScript'],
        yearsOfExperience: 7,
        salaryExpectation: 130_000,
        preferredLocations: ['Remote'],
        preferredJobTypes: ['FULL_TIME'],
      })),
    },
  };

  const billing = { getEarlyAccessHours: jest.fn(async () => 0) };
  const providers = {
    get: jest.fn(() => ({
      provider: AiProvider.ANTHROPIC,
      defaultModel: 'claude-sonnet-4-20250514',
      complete,
    })),
  };

  const service = new EvaluationsService(
    prisma as unknown as PrismaService,
    billing as unknown as BillingService,
    providers as unknown as AiProviderRegistry,
  );

  return { service, prisma, complete };
}

describe('EvaluationsService.evaluate', () => {
  it('persists the graded evaluation to job_evaluations', async () => {
    const { service, prisma, complete } = createHarness();

    const result = await service.evaluate(USER, JOB_ID, CREDENTIALS);

    expect(complete).toHaveBeenCalledTimes(1);
    expect(prisma.jobEvaluation.upsert).toHaveBeenCalledTimes(1);

    const args = prisma.jobEvaluation.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId_jobId: { userId: USER.id, jobId: JOB_ID } });
    expect(args.create).toMatchObject({
      userId: USER.id,
      jobId: JOB_ID,
      score: 4,
      grade: EvaluationGrade.B,
      provider: AiProvider.ANTHROPIC,
      model: 'claude-3-5-haiku-20241022',
      promptTokens: 900,
      completionTokens: 210,
    });
    expect(args.create.durationMs).toBeGreaterThanOrEqual(0);
    // The rubric is stored with the weights that produced the score.
    expect(args.create.rubric.skillsMatch).toEqual({
      score: 4,
      weight: EVALUATION_CRITERIA[0].weight,
      notes: 'because',
    });

    expect(result.grade).toBe(EvaluationGrade.B);
    expect(result.cached).toBe(false);
  });

  it('never writes the API key into the row', async () => {
    const { service, prisma } = createHarness();

    await service.evaluate(USER, JOB_ID, CREDENTIALS);
    const args = prisma.jobEvaluation.upsert.mock.calls[0][0];

    // The whole point of BYOK: only the vendor name and model id are retained.
    expect(JSON.stringify(args)).not.toContain(CREDENTIALS.apiKey);
    expect(Object.keys(args.create)).not.toContain('apiKey');
  });

  it('sends both the rubric instructions and the job to the provider', async () => {
    const { service, complete } = createHarness();

    await service.evaluate(USER, JOB_ID, CREDENTIALS);
    const request = complete.mock.calls[0][0];

    expect(request.apiKey).toBe(CREDENTIALS.apiKey);
    expect(request.model).toBe(CREDENTIALS.model);
    expect(request.system).toContain('skillsMatch');
    expect(request.prompt).toContain('Senior Engineer');
    expect(request.prompt).toContain('Backend engineer');
  });

  it('returns the stored evaluation without spending tokens', async () => {
    const { service, complete, prisma } = createHarness({ existing: storedRow() });

    const result = await service.evaluate(USER, JOB_ID, CREDENTIALS);

    // Re-billing the user for a grade already held would be a bug, not a cache miss.
    expect(complete).not.toHaveBeenCalled();
    expect(prisma.jobEvaluation.upsert).not.toHaveBeenCalled();
    expect(result.cached).toBe(true);
    expect(result.grade).toBe(EvaluationGrade.B);
  });

  it('re-runs and overwrites when force is set', async () => {
    const { service, complete, prisma } = createHarness({ existing: storedRow() });

    const result = await service.evaluate(USER, JOB_ID, CREDENTIALS, { force: true });

    expect(complete).toHaveBeenCalledTimes(1);
    expect(prisma.jobEvaluation.upsert).toHaveBeenCalledTimes(1);
    expect(result.cached).toBe(false);
  });

  it('refuses to evaluate an embargoed listing, before calling the provider', async () => {
    const embargoUntil = new Date(Date.now() + 6 * 3600 * 1000);
    const { service, complete } = createHarness({
      job: jobRow({ earlyAccessUntil: embargoUntil }),
    });

    await expect(service.evaluate(USER, JOB_ID, CREDENTIALS)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    // Otherwise the rubric notes would describe content the plan cannot read.
    expect(complete).not.toHaveBeenCalled();
  });

  it('lets an admin evaluate an embargoed listing', async () => {
    const { service, complete } = createHarness({
      job: jobRow({ earlyAccessUntil: new Date(Date.now() + 6 * 3600 * 1000) }),
    });

    await service.evaluate({ ...USER, role: UserRole.ADMIN }, JOB_ID, CREDENTIALS);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('404s on an unknown job without touching the provider', async () => {
    const { service, complete } = createHarness();
    (service as unknown as { prisma: { job: { findUnique: jest.Mock } } }).prisma.job.findUnique =
      jest.fn(async () => null);

    await expect(service.evaluate(USER, JOB_ID, CREDENTIALS)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(complete).not.toHaveBeenCalled();
  });
});
