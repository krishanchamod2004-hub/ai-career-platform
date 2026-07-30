import { ExperienceLevel, JobType } from '@ai-career/shared';

export interface ParsedExperience {
  level: ExperienceLevel | null;
  minYears: number | null;
}

/** Ordered most-specific-first: "senior staff engineer" must not match "staff" only. */
const LEVEL_PATTERNS: Array<[RegExp, ExperienceLevel]> = [
  [/\b(intern|internship|co-?op|working student|praktikum)\b/i, ExperienceLevel.INTERNSHIP],
  [/\b(chief|c-?level|cto|ceo|cfo|coo|vp|vice president|head of|director)\b/i, ExperienceLevel.EXECUTIVE],
  [/\b(principal|distinguished|fellow|architect)\b/i, ExperienceLevel.PRINCIPAL],
  [/\b(staff|lead|team lead|tech lead|manager)\b/i, ExperienceLevel.LEAD],
  [/\b(senior|sr\.?|snr)\b/i, ExperienceLevel.SENIOR],
  [/\b(mid-?level|mid-?senior|intermediate|ii+\b)\b/i, ExperienceLevel.MID],
  [/\b(junior|jr\.?)\b/i, ExperienceLevel.JUNIOR],
  [/\b(entry-?level|graduate|new grad|associate|trainee|apprentice)\b/i, ExperienceLevel.ENTRY],
];

const YEARS_PATTERNS = [
  /(\d{1,2})\s*\+?\s*(?:-|to|–)?\s*(?:\d{1,2})?\s*\+?\s*years?(?:\s+of)?\s+(?:relevant\s+|professional\s+|proven\s+)?(?:experience|exp\b)/i,
  /(?:experience|exp)\D{0,20}?(\d{1,2})\s*\+?\s*years?/i,
  /minimum\s+(?:of\s+)?(\d{1,2})\s*years?/i,
];

/**
 * Infers seniority from the title first (highest signal), then the description.
 * Also extracts "N+ years of experience" so numeric filters work even when the
 * title carries no seniority marker.
 */
export function parseExperience(title: string, description?: string | null): ParsedExperience {
  const level = matchLevel(title) ?? matchLevel(description ?? '');
  const minYears = extractMinYears(description ?? '') ?? extractMinYears(title);

  // A stated year count is stronger evidence than an absent title marker.
  const derivedLevel = level ?? (minYears !== null ? levelFromYears(minYears) : null);

  return { level: derivedLevel, minYears };
}

/** Maps a source's employment-type string onto the JobType enum. */
export function parseJobType(
  employmentType?: string | null,
  title?: string | null,
): JobType | null {
  const haystack = `${employmentType ?? ''} ${title ?? ''}`.toLowerCase();
  if (!haystack.trim()) {
    return null;
  }
  if (/\b(intern|internship|co-?op|working student)\b/.test(haystack)) {
    return JobType.INTERNSHIP;
  }
  if (/\b(part[-\s]?time|parttime|teilzeit)\b/.test(haystack)) {
    return JobType.PART_TIME;
  }
  if (/\b(freelance|freelancer)\b/.test(haystack)) {
    return JobType.FREELANCE;
  }
  if (/\b(contract|contractor|temporary|temp|fixed[-\s]?term|b2b)\b/.test(haystack)) {
    return JobType.CONTRACT;
  }
  if (/\b(full[-\s]?time|fulltime|permanent|regular|vollzeit)\b/.test(haystack)) {
    return JobType.FULL_TIME;
  }
  return null;
}

function matchLevel(text: string): ExperienceLevel | null {
  if (!text) {
    return null;
  }
  for (const [pattern, level] of LEVEL_PATTERNS) {
    if (pattern.test(text)) {
      return level;
    }
  }
  return null;
}

function extractMinYears(text: string): number | null {
  if (!text) {
    return null;
  }
  for (const pattern of YEARS_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const years = Number(match[1]);
      if (Number.isFinite(years) && years >= 0 && years <= 30) {
        return years;
      }
    }
  }
  return null;
}

function levelFromYears(years: number): ExperienceLevel {
  if (years <= 0) return ExperienceLevel.ENTRY;
  if (years <= 2) return ExperienceLevel.JUNIOR;
  if (years <= 5) return ExperienceLevel.MID;
  if (years <= 8) return ExperienceLevel.SENIOR;
  return ExperienceLevel.LEAD;
}
