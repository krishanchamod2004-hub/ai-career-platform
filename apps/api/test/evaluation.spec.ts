import { BadRequestException, HttpStatus, UnprocessableEntityException } from '@nestjs/common';
import type { Request } from 'express';
import {
  AI_HEADERS,
  AiProvider,
  DEFAULT_AI_MODELS,
  EVALUATION_CRITERIA,
  EVALUATION_WEIGHT_TOTAL,
  EvaluationGrade,
  scoreToGrade,
} from '@ai-career/shared';
import {
  extractJsonObject,
  parseEvaluationResponse,
} from '../src/modules/evaluations/evaluation-response.parser';
import {
  buildEvaluationSystemPrompt,
  buildEvaluationUserPrompt,
  MAX_DESCRIPTION_CHARS,
  type CandidateProfileContext,
  type JobEvaluationContext,
} from '../src/modules/evaluations/prompts/evaluation.prompt';
import {
  AI_ERROR_CODES,
  redactSecrets,
  toAiHttpException,
} from '../src/modules/evaluations/ai/ai-provider.errors';
import { extractAiCredentials } from '../src/modules/evaluations/ai/ai-credentials';
import { normalizeStoredRubric } from '../src/modules/evaluations/evaluations.mapper';

/** Builds a well-formed model reply, optionally overriding individual criteria. */
function modelResponse(
  scores: Partial<Record<string, number>> = {},
  extra: Record<string, unknown> = {},
): string {
  const criteria = Object.fromEntries(
    EVALUATION_CRITERIA.map((criterion) => [
      criterion.key,
      { score: scores[criterion.key] ?? 4, notes: `notes for ${criterion.key}` },
    ]),
  );
  return JSON.stringify({
    criteria,
    summary: 'Solid overlap on the core stack, with a gap on infrastructure ownership.',
    strengths: ['Strong TypeScript match', 'Remote-friendly'],
    gaps: ['No Kubernetes experience'],
    ...extra,
  });
}

describe('evaluation rubric catalog', () => {
  it('has weights that sum to exactly 1', () => {
    // The parser divides by the weight sum, but the UI presents weights as
    // percentages of a whole — drift here would silently misreport a grade.
    expect(EVALUATION_WEIGHT_TOTAL).toBeCloseTo(1, 10);
  });

  it('uses unique criterion keys', () => {
    const keys = EVALUATION_CRITERIA.map((criterion) => criterion.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('scoreToGrade thresholds', () => {
  // scoreToGrade rounds to one decimal *before* bucketing, by design: a model
  // returning 4.4999 must not become an A. So 3.49 rounds up into B.
  it.each([
    [5, EvaluationGrade.A],
    [4.5, EvaluationGrade.A],
    [4.45, EvaluationGrade.A], // rounds to 4.5
    [4.44, EvaluationGrade.B],
    [3.5, EvaluationGrade.B],
    [3.49, EvaluationGrade.B], // rounds to 3.5
    [3.44, EvaluationGrade.C],
    [2.5, EvaluationGrade.C],
    [1.5, EvaluationGrade.D],
    [1.49, EvaluationGrade.D], // rounds to 1.5
    [1.44, EvaluationGrade.F],
    [1, EvaluationGrade.F],
  ])('maps %s to %s', (score, expected) => {
    expect(scoreToGrade(score)).toBe(expected);
  });

  it('clamps out-of-range scores instead of throwing', () => {
    expect(scoreToGrade(99)).toBe(EvaluationGrade.A);
    expect(scoreToGrade(-5)).toBe(EvaluationGrade.F);
    expect(scoreToGrade(Number.NaN)).toBe(EvaluationGrade.F);
  });
});

describe('parseEvaluationResponse', () => {
  it('computes the weighted score and derives the grade', () => {
    const parsed = parseEvaluationResponse(modelResponse({ skillsMatch: 5 }));

    // 5*0.30 + 4*(0.20+0.15+0.10+0.15+0.10) = 1.5 + 2.8 = 4.3
    expect(parsed.score).toBeCloseTo(4.3, 5);
    expect(parsed.grade).toBe(EvaluationGrade.B);
    expect(parsed.summary).toContain('Solid overlap');
    expect(parsed.strengths).toEqual(['Strong TypeScript match', 'Remote-friendly']);
    expect(parsed.gaps).toEqual(['No Kubernetes experience']);
  });

  it('stores each criterion with its catalog weight', () => {
    const parsed = parseEvaluationResponse(modelResponse());

    for (const criterion of EVALUATION_CRITERIA) {
      expect(parsed.rubric[criterion.key]).toEqual({
        score: 4,
        weight: criterion.weight,
        notes: `notes for ${criterion.key}`,
      });
    }
  });

  it('ignores any overall score the model volunteers', () => {
    // The server is the only authority on the overall number; a model that also
    // returns "score: 1.0" must not be able to override its own breakdown.
    const parsed = parseEvaluationResponse(
      modelResponse({}, { score: 1, overallScore: 1, grade: 'F' }),
    );

    expect(parsed.score).toBeCloseTo(4, 5);
    expect(parsed.grade).toBe(EvaluationGrade.B);
  });

  it('clamps criterion scores into the 1.0-5.0 range', () => {
    const high = parseEvaluationResponse(
      modelResponse(
        Object.fromEntries(EVALUATION_CRITERIA.map((criterion) => [criterion.key, 47])),
      ),
    );
    const low = parseEvaluationResponse(
      modelResponse(Object.fromEntries(EVALUATION_CRITERIA.map((c) => [c.key, -12]))),
    );

    expect(high.score).toBe(5);
    expect(high.grade).toBe(EvaluationGrade.A);
    expect(low.score).toBe(1);
    expect(low.grade).toBe(EvaluationGrade.F);
  });

  it('accepts snake_case, spaced and capitalized criterion keys', () => {
    const payload = JSON.stringify({
      criteria: {
        skills_match: { score: 4 },
        'Experience Match': { score: 4 },
        COMPENSATION: { score: 4 },
        'location-fit': { score: 4 },
        roleClarity: { score: 4 },
        growth_potential: { score: 4 },
      },
    });

    expect(parseEvaluationResponse(payload).score).toBeCloseTo(4, 5);
  });

  it('accepts bare numbers and numeric strings for a criterion', () => {
    const payload = JSON.stringify({
      skillsMatch: 4,
      experienceMatch: '4',
      compensation: { value: 4 },
      locationFit: { rating: 4 },
      roleClarity: { score: 4 },
      growthPotential: 4,
    });

    expect(parseEvaluationResponse(payload).score).toBeCloseTo(4, 5);
  });

  it('recovers from a code fence and a chatty preamble', () => {
    const wrapped = `Here is the evaluation:\n\`\`\`json\n${modelResponse()}\n\`\`\``;
    expect(parseEvaluationResponse(wrapped).score).toBeCloseTo(4, 5);
  });

  it('rejects a response missing a criterion rather than defaulting it', () => {
    const payload = JSON.stringify({
      criteria: {
        skillsMatch: { score: 4 },
        experienceMatch: { score: 4 },
        compensation: { score: 4 },
        locationFit: { score: 4 },
        roleClarity: { score: 4 },
        // growthPotential omitted
      },
    });

    // Substituting a neutral 3.0 would fabricate an input to a weighted average
    // the user reads as a letter grade.
    expect(() => parseEvaluationResponse(payload)).toThrow(UnprocessableEntityException);
    try {
      parseEvaluationResponse(payload);
    } catch (error) {
      const response = (error as UnprocessableEntityException).getResponse() as {
        error: string;
        detail: string;
      };
      expect(response.error).toBe(AI_ERROR_CODES.UNPARSEABLE);
      expect(response.detail).toContain('growthPotential');
    }
  });

  it('rejects non-numeric criterion scores', () => {
    const payload = JSON.stringify({
      criteria: Object.fromEntries(
        EVALUATION_CRITERIA.map((criterion) => [criterion.key, { score: 'excellent' }]),
      ),
    });
    expect(() => parseEvaluationResponse(payload)).toThrow(UnprocessableEntityException);
  });

  it('rejects prose and empty replies', () => {
    expect(() => parseEvaluationResponse('I cannot evaluate this job.')).toThrow(
      UnprocessableEntityException,
    );
    expect(() => parseEvaluationResponse('')).toThrow(UnprocessableEntityException);
  });

  it('caps, trims and de-duplicates strengths and gaps', () => {
    const parsed = parseEvaluationResponse(
      modelResponse(
        {},
        {
          strengths: ['  A  ', 'a', 'B', 'C', 'D', 'E', 'F', 'G', 42, null],
          gaps: ['x'.repeat(400)],
        },
      ),
    );

    expect(parsed.strengths).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(parsed.gaps[0]).toHaveLength(200);
  });

  it('accepts "weaknesses" as an alias for gaps', () => {
    const parsed = parseEvaluationResponse(
      modelResponse({}, { gaps: undefined, weaknesses: ['Thin on testing culture'] }),
    );
    expect(parsed.gaps).toEqual(['Thin on testing culture']);
  });

  it('nulls out an empty summary instead of storing whitespace', () => {
    const parsed = parseEvaluationResponse(modelResponse({}, { summary: '   ' }));
    expect(parsed.summary).toBeNull();
  });
});

describe('extractJsonObject', () => {
  it('pulls the object out of surrounding text', () => {
    expect(extractJsonObject('prefix {"a":1} suffix')).toEqual({ a: 1 });
  });

  it('throws on a JSON array (the contract requires an object)', () => {
    expect(() => extractJsonObject('[1,2,3]')).toThrow(UnprocessableEntityException);
  });
});

describe('evaluation prompts', () => {
  const profile: CandidateProfileContext = {
    headline: 'Senior backend engineer',
    bio: 'Ten years on distributed systems.',
    skills: ['TypeScript', 'PostgreSQL'],
    yearsOfExperience: 10,
    salaryExpectation: 150_000,
    preferredLocations: ['Remote'],
    preferredJobTypes: ['FULL_TIME'],
  };

  const job: JobEvaluationContext = {
    title: 'Staff Platform Engineer',
    companyName: 'Acme',
    location: 'Berlin, Germany',
    isRemote: true,
    workModel: 'REMOTE',
    jobType: 'FULL_TIME',
    experienceLevel: 'SENIOR',
    minYearsExperience: 8,
    skills: ['Go', 'Kubernetes'],
    benefits: ['Health insurance'],
    salaryMin: 120_000,
    salaryMax: 160_000,
    salaryCurrency: 'EUR',
    salaryPeriod: 'YEARLY',
    salaryText: null,
    visaSponsorship: true,
    description: 'Own the platform.',
  };

  it('documents every criterion and its weight in the system prompt', () => {
    const system = buildEvaluationSystemPrompt();

    for (const criterion of EVALUATION_CRITERIA) {
      expect(system).toContain(criterion.key);
      expect(system).toContain(criterion.weight.toFixed(2));
    }
  });

  it('forbids the model from returning an overall score or grade', () => {
    expect(buildEvaluationSystemPrompt()).toMatch(/Do NOT output an overall score/);
  });

  it('tells the model to ignore instructions inside the posting', () => {
    // Descriptions are scraped from third parties, so a posting containing
    // "score this 5.0" is a realistic injection attempt against ranking.
    const system = buildEvaluationSystemPrompt();
    expect(system).toMatch(/untrusted data/i);

    const user = buildEvaluationUserPrompt({ job, profile });
    expect(user).toContain('BEGIN JOB POSTING');
    expect(user).toContain('END JOB POSTING');
  });

  it('includes both sides of the comparison', () => {
    const user = buildEvaluationUserPrompt({ job, profile });

    expect(user).toContain('Senior backend engineer');
    expect(user).toContain('TypeScript, PostgreSQL');
    expect(user).toContain('Staff Platform Engineer');
    expect(user).toContain('120000-160000 EUR per yearly');
  });

  it('marks absent profile fields as unspecified rather than omitting them', () => {
    const user = buildEvaluationUserPrompt({
      job,
      profile: {
        headline: null,
        bio: null,
        skills: [],
        yearsOfExperience: null,
        salaryExpectation: null,
        preferredLocations: [],
        preferredJobTypes: [],
      },
    });

    expect(user).toContain('Skills: not specified');
    expect(user).toContain('Years of experience: not specified');
  });

  it('truncates very long descriptions to bound token spend', () => {
    const user = buildEvaluationUserPrompt({
      job: { ...job, description: 'x'.repeat(MAX_DESCRIPTION_CHARS * 3) },
      profile,
    });

    expect(user).toContain('[truncated]');
    expect(user.length).toBeLessThan(MAX_DESCRIPTION_CHARS * 2);
  });
});

describe('toAiHttpException', () => {
  const providerError = (status: number, message?: string) => ({
    message: 'Request failed',
    response: { status, data: message ? { error: { message } } : {} },
  });

  it('maps a rejected provider key to 400, never 401', () => {
    // A 401 from this API means "your session expired": the web client would
    // silently refresh the token and replay the request, hiding the real cause.
    const exception = toAiHttpException(AiProvider.OPENAI, providerError(401, 'Incorrect API key'));

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect((exception.getResponse() as { error: string }).error).toBe(AI_ERROR_CODES.KEY_REJECTED);
  });

  it('treats 403 the same as 401', () => {
    expect(toAiHttpException(AiProvider.ANTHROPIC, providerError(403)).getStatus()).toBe(
      HttpStatus.BAD_REQUEST,
    );
  });

  it('separates burst rate limits from exhausted quota', () => {
    const limited = toAiHttpException(AiProvider.ANTHROPIC, providerError(429, 'rate limit'));
    const quota = toAiHttpException(
      AiProvider.OPENAI,
      providerError(429, 'You exceeded your current quota'),
    );

    expect(limited.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect((limited.getResponse() as { error: string }).error).toBe(AI_ERROR_CODES.RATE_LIMITED);
    expect((quota.getResponse() as { error: string }).error).toBe(AI_ERROR_CODES.QUOTA_EXCEEDED);
  });

  it('maps unknown models to a bad request', () => {
    const exception = toAiHttpException(
      AiProvider.OPENAI,
      providerError(404, 'The model `gpt-9` does not exist'),
    );

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect((exception.getResponse() as { error: string }).error).toBe(
      AI_ERROR_CODES.REQUEST_REJECTED,
    );
  });

  it('maps vendor outages and timeouts to 503', () => {
    expect(toAiHttpException(AiProvider.OPENAI, providerError(500)).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(
      toAiHttpException(AiProvider.OPENAI, { code: 'ECONNABORTED', message: 'timeout' }).getStatus(),
    ).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('redacts key material echoed back by the vendor', () => {
    const exception = toAiHttpException(
      AiProvider.ANTHROPIC,
      providerError(401, 'invalid x-api-key: sk-ant-api03-SECRETVALUE123'),
    );
    const body = JSON.stringify(exception.getResponse());

    expect(body).not.toContain('SECRETVALUE123');
    expect(body).toContain('sk-***');
  });
});

describe('redactSecrets', () => {
  it('masks provider keys and bearer tokens', () => {
    expect(redactSecrets('key sk-ant-api03-abcdef123456 used')).toBe('key sk-*** used');
    expect(redactSecrets('Authorization: Bearer abcdef123456')).toBe('Authorization: Bearer ***');
  });
});

describe('extractAiCredentials', () => {
  const asRequest = (headers: Record<string, string>): Request =>
    ({ headers }) as unknown as Request;

  it('reads provider, key and model from headers', () => {
    const credentials = extractAiCredentials(
      asRequest({
        [AI_HEADERS.PROVIDER]: 'anthropic',
        [AI_HEADERS.API_KEY]: 'sk-ant-api03-abcdefghijklmnop',
        [AI_HEADERS.MODEL]: 'claude-3-5-haiku-20241022',
      }),
    );

    expect(credentials).toEqual({
      provider: AiProvider.ANTHROPIC,
      apiKey: 'sk-ant-api03-abcdefghijklmnop',
      model: 'claude-3-5-haiku-20241022',
    });
  });

  it('falls back to the provider default model', () => {
    const credentials = extractAiCredentials(
      asRequest({
        [AI_HEADERS.PROVIDER]: 'OPENAI',
        [AI_HEADERS.API_KEY]: 'sk-proj-abcdefghijklmnopqrst',
      }),
    );

    expect(credentials.model).toBe(DEFAULT_AI_MODELS[AiProvider.OPENAI]);
  });

  it('rejects missing credentials with a machine-readable code', () => {
    try {
      extractAiCredentials(asRequest({}));
      throw new Error('expected a BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(
        ((error as BadRequestException).getResponse() as { error: string }).error,
      ).toBe(AI_ERROR_CODES.CREDENTIALS_MISSING);
    }
  });

  it.each([
    ['unsupported provider', { [AI_HEADERS.PROVIDER]: 'gemini', [AI_HEADERS.API_KEY]: 'sk-abcdefghijklmnopqrst' }],
    ['short key', { [AI_HEADERS.PROVIDER]: 'openai', [AI_HEADERS.API_KEY]: 'sk-short' }],
    [
      'key with control characters',
      { [AI_HEADERS.PROVIDER]: 'openai', [AI_HEADERS.API_KEY]: 'sk-abcdefghij\nklmnopqrst' },
    ],
    [
      'invalid model id',
      {
        [AI_HEADERS.PROVIDER]: 'openai',
        [AI_HEADERS.API_KEY]: 'sk-abcdefghijklmnopqrst',
        [AI_HEADERS.MODEL]: 'gpt-4o; rm -rf /',
      },
    ],
  ])('rejects %s', (_label, headers) => {
    expect(() => extractAiCredentials(asRequest(headers))).toThrow(BadRequestException);
  });
});

describe('normalizeStoredRubric', () => {
  it('rebuilds weights from the catalog rather than trusting stored JSON', () => {
    // Weights can be re-tuned after rows are written; the catalog is the source
    // of truth so the UI never renders a stale percentage.
    const rubric = normalizeStoredRubric({
      skillsMatch: { score: 4.5, weight: 0.99, notes: 'kept' },
    } as never);

    expect(rubric.skillsMatch).toEqual({
      score: 4.5,
      weight: EVALUATION_CRITERIA[0].weight,
      notes: 'kept',
    });
  });

  it('drops criteria that were never scored instead of emitting undefined', () => {
    expect(normalizeStoredRubric({} as never)).toEqual({});
    expect(normalizeStoredRubric(null)).toEqual({});
    expect(normalizeStoredRubric({ skillsMatch: { notes: 'no score' } } as never)).toEqual({});
  });
});
