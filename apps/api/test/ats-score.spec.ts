import { UnprocessableEntityException } from '@nestjs/common';
import { parseAtsScoreResponse } from '../src/modules/resumes/ats-score-response.parser';
import {
  buildAtsScoreSystemPrompt,
  buildAtsScoreUserPrompt,
} from '../src/modules/resumes/prompts/ats-score.prompt';

function modelResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    score: 78,
    missingKeywords: ['Kubernetes', 'GraphQL'],
    suggestions: 'Add measurable outcomes to your most recent role.',
    ...overrides,
  });
}

describe('parseAtsScoreResponse', () => {
  it('parses a well-formed response', () => {
    const parsed = parseAtsScoreResponse(modelResponse());
    expect(parsed.score).toBe(78);
    expect(parsed.missingKeywords).toEqual(['Kubernetes', 'GraphQL']);
    expect(parsed.suggestions).toBe('Add measurable outcomes to your most recent role.');
  });

  it('clamps out-of-range scores into 0-100', () => {
    expect(parseAtsScoreResponse(modelResponse({ score: 140 })).score).toBe(100);
    expect(parseAtsScoreResponse(modelResponse({ score: -20 })).score).toBe(0);
  });

  it('rounds a fractional score to an integer', () => {
    expect(parseAtsScoreResponse(modelResponse({ score: 77.6 })).score).toBe(78);
  });

  it('accepts a stringified numeric score', () => {
    expect(parseAtsScoreResponse(modelResponse({ score: '82' })).score).toBe(82);
  });

  it('fails loudly when score is missing rather than defaulting', () => {
    expect(() => parseAtsScoreResponse(JSON.stringify({ missingKeywords: [] }))).toThrow(
      UnprocessableEntityException,
    );
  });

  it('fails loudly when score is non-numeric', () => {
    expect(() =>
      parseAtsScoreResponse(JSON.stringify({ score: 'excellent match' })),
    ).toThrow(UnprocessableEntityException);
  });

  it('tolerates alternate field names for score and suggestions', () => {
    const parsed = parseAtsScoreResponse(
      JSON.stringify({ matchScore: 55, feedback: 'Tighten your bullet points.' }),
    );
    expect(parsed.score).toBe(55);
    expect(parsed.suggestions).toBe('Tighten your bullet points.');
  });

  it('tolerates a fenced JSON block, mirroring Claude output without JSON mode', () => {
    const fenced = '```json\n' + modelResponse() + '\n```';
    expect(parseAtsScoreResponse(fenced).score).toBe(78);
  });

  it('deduplicates and caps missing keywords at 15', () => {
    const many = Array.from({ length: 20 }, (_, i) => `Skill ${i}`);
    const parsed = parseAtsScoreResponse(
      modelResponse({ missingKeywords: [...many, 'Skill 0'] }),
    );
    expect(parsed.missingKeywords).toHaveLength(15);
  });

  it('defaults missing suggestions to null rather than an empty string', () => {
    const parsed = parseAtsScoreResponse(modelResponse({ suggestions: undefined }));
    expect(parsed.suggestions).toBeNull();
  });

  it('caps an overlong suggestions string', () => {
    const parsed = parseAtsScoreResponse(
      modelResponse({ suggestions: 'x'.repeat(2000) }),
    );
    expect(parsed.suggestions).toHaveLength(800);
  });
});

describe('ATS score prompts', () => {
  it('fences the job posting and the resume as untrusted data', () => {
    const prompt = buildAtsScoreUserPrompt({
      job: { title: 'Backend Engineer', companyName: 'Acme', skills: ['Go'], description: 'Build things.' },
      resumeText: 'Experienced engineer.',
    });
    expect(prompt).toContain('BEGIN JOB POSTING');
    expect(prompt).toContain('BEGIN RESUME');
    expect(prompt).toContain('untrusted data');
  });

  it('instructs the model to ignore embedded instructions', () => {
    expect(buildAtsScoreSystemPrompt()).toMatch(/ignore them and score/i);
  });

  it('requests exactly the score/missingKeywords/suggestions JSON contract', () => {
    const system = buildAtsScoreSystemPrompt();
    expect(system).toContain('"score"');
    expect(system).toContain('"missingKeywords"');
    expect(system).toContain('"suggestions"');
  });
});
