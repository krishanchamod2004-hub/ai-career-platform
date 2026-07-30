import { UnprocessableEntityException } from '@nestjs/common';
import { AI_ERROR_CODES } from '../evaluations/ai/ai-provider.errors';
import { extractJsonObject } from '../evaluations/evaluation-response.parser';

const MAX_SUGGESTIONS_CHARS = 800;
const MAX_KEYWORDS = 15;
const MAX_KEYWORD_CHARS = 80;

export interface ParsedAtsScore {
  /** 0-100 integer, clamped. */
  score: number;
  missingKeywords: string[];
  suggestions: string | null;
}

function fail(detail: string): never {
  throw new UnprocessableEntityException({
    message: 'The AI response did not match the required ATS score format. Retry, or pick a stronger model.',
    error: AI_ERROR_CODES.UNPARSEABLE,
    detail,
  });
}

function clampScore(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)));
}

function readScore(raw: unknown): number | null {
  const numeric = typeof raw === 'string' ? Number(raw) : raw;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? clampScore(numeric) : null;
}

function readKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      continue;
    }
    const value = entry.trim().slice(0, MAX_KEYWORD_CHARS);
    const dedupeKey = value.toLowerCase();
    if (value.length === 0 || seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    items.push(value);
    if (items.length === MAX_KEYWORDS) {
      break;
    }
  }
  return items;
}

/**
 * Validates an assistant reply and turns it into the persisted ATS score shape.
 *
 * `score` is required — a missing or non-numeric score fails loudly rather than
 * defaulting to 0, which would fabricate a number the user reads as a real
 * match percentage.
 */
export function parseAtsScoreResponse(text: string): ParsedAtsScore {
  const payload = extractJsonObject(text) as Record<string, unknown>;

  const score = readScore(payload.score ?? payload.matchScore ?? payload.value);
  if (score === null) {
    fail('missing or non-numeric "score"');
  }

  const suggestionsRaw = payload.suggestions ?? payload.suggestion ?? payload.feedback;
  const suggestions =
    typeof suggestionsRaw === 'string' && suggestionsRaw.trim().length > 0
      ? suggestionsRaw.trim().slice(0, MAX_SUGGESTIONS_CHARS)
      : null;

  return {
    score,
    missingKeywords: readKeywords(payload.missingKeywords ?? payload.missing_keywords ?? payload.gaps),
    suggestions,
  };
}
