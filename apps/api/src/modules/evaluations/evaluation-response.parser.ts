import { UnprocessableEntityException } from '@nestjs/common';
import {
  EVALUATION_CRITERIA,
  EVALUATION_SCORE_MAX,
  EVALUATION_SCORE_MIN,
  scoreToGrade,
  type EvaluationCriterionKey,
  type EvaluationGrade,
  type EvaluationRubric,
} from '@ai-career/shared';
import { AI_ERROR_CODES } from './ai/ai-provider.errors';

const MAX_NOTES_CHARS = 300;
const MAX_SUMMARY_CHARS = 800;
const MAX_LIST_ITEMS = 5;
const MAX_LIST_ITEM_CHARS = 200;

export interface ParsedEvaluation {
  /** Weighted 1.0-5.0 mean of the criterion scores, rounded to one decimal. */
  score: number;
  grade: EvaluationGrade;
  rubric: EvaluationRubric;
  summary: string | null;
  strengths: string[];
  gaps: string[];
}

/** Lookup that tolerates snake_case / spaced / capitalized variants of a key. */
const CANONICAL_KEYS = new Map<string, EvaluationCriterionKey>(
  EVALUATION_CRITERIA.map((criterion) => [normalizeKey(criterion.key), criterion.key]),
);

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function fail(detail: string): never {
  throw new UnprocessableEntityException({
    message:
      'The AI response did not match the required evaluation format. Retry, or pick a stronger model.',
    error: AI_ERROR_CODES.UNPARSEABLE,
    detail,
  });
}

/**
 * Pulls the JSON object out of an assistant reply.
 *
 * OpenAI's json_object mode guarantees valid JSON, but Claude has no JSON mode,
 * so a stray "Here is the evaluation:" preamble or a ```json fence is a real
 * (if uncommon) outcome and must not fail the request.
 */
export function extractJsonObject(text: string): unknown {
  const trimmed = (text ?? '').trim();
  if (!trimmed) {
    fail('empty response');
  }

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const candidates = [withoutFence];
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start !== -1 && end > start) {
    candidates.push(withoutFence.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        fail('response was a JSON array; an object keyed by criterion is required');
      }
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }
      // Try the next candidate.
    }
  }

  return fail('response was not valid JSON');
}

function clampScore(value: number): number {
  const bounded = Math.min(EVALUATION_SCORE_MAX, Math.max(EVALUATION_SCORE_MIN, value));
  return Math.round(bounded * 10) / 10;
}

function readScore(raw: unknown): number | null {
  // Accept `{ score: 4.5 }`, a bare `4.5`, or the string "4.5" — all observed.
  const candidate =
    typeof raw === 'object' && raw !== null
      ? (raw as { score?: unknown; value?: unknown; rating?: unknown }).score ??
        (raw as { value?: unknown }).value ??
        (raw as { rating?: unknown }).rating
      : raw;

  const numeric = typeof candidate === 'string' ? Number(candidate) : candidate;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? clampScore(numeric) : null;
}

function readNotes(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const notes = (raw as { notes?: unknown; note?: unknown; reason?: unknown }).notes ??
    (raw as { note?: unknown }).note ??
    (raw as { reason?: unknown }).reason;
  if (typeof notes !== 'string') {
    return null;
  }
  const trimmed = notes.trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_NOTES_CHARS) : null;
}

function readStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      continue;
    }
    const value = entry.trim().slice(0, MAX_LIST_ITEM_CHARS);
    const dedupeKey = value.toLowerCase();
    if (value.length === 0 || seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    items.push(value);
    if (items.length === MAX_LIST_ITEMS) {
      break;
    }
  }
  return items;
}

/** Accepts both `{ criteria: {...} }` and a flat object keyed by criterion. */
function locateCriteria(payload: Record<string, unknown>): Record<string, unknown> {
  const nested = payload.criteria ?? payload.rubric ?? payload.scores;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return payload;
}

/**
 * Validates an assistant reply and turns it into the persisted evaluation shape.
 *
 * All six criteria are required. A missing dimension is treated as a failed call
 * rather than defaulted, because substituting a neutral 3.0 would silently
 * fabricate the input to a weighted average the user sees as a letter grade.
 */
export function parseEvaluationResponse(text: string): ParsedEvaluation {
  const payload = extractJsonObject(text) as Record<string, unknown>;
  const rawCriteria = locateCriteria(payload);

  // Re-key by canonical name so skills_match / "Skills Match" both resolve.
  const byCanonicalKey = new Map<EvaluationCriterionKey, unknown>();
  for (const [key, value] of Object.entries(rawCriteria)) {
    const canonical = CANONICAL_KEYS.get(normalizeKey(key));
    if (canonical && !byCanonicalKey.has(canonical)) {
      byCanonicalKey.set(canonical, value);
    }
  }

  const rubric = {} as EvaluationRubric;
  const missing: string[] = [];
  let weightedTotal = 0;
  let weightSum = 0;

  for (const criterion of EVALUATION_CRITERIA) {
    const score = readScore(byCanonicalKey.get(criterion.key));
    if (score === null) {
      missing.push(criterion.key);
      continue;
    }
    rubric[criterion.key] = {
      score,
      weight: criterion.weight,
      notes: readNotes(byCanonicalKey.get(criterion.key)),
    };
    weightedTotal += score * criterion.weight;
    weightSum += criterion.weight;
  }

  if (missing.length > 0) {
    fail(`missing or non-numeric criteria: ${missing.join(', ')}`);
  }

  // weightSum is 1 by construction; dividing keeps the maths correct if the
  // catalog ever ships weights that do not total exactly 1.
  const score = clampScore(weightedTotal / weightSum);

  const summaryRaw = payload.summary ?? payload.overview;
  const summary =
    typeof summaryRaw === 'string' && summaryRaw.trim().length > 0
      ? summaryRaw.trim().slice(0, MAX_SUMMARY_CHARS)
      : null;

  return {
    score,
    grade: scoreToGrade(score),
    rubric,
    summary,
    strengths: readStringList(payload.strengths),
    gaps: readStringList(payload.gaps ?? payload.weaknesses ?? payload.concerns),
  };
}
