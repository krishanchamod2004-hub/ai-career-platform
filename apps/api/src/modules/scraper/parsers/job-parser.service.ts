import { Injectable } from '@nestjs/common';
import type { RawJob } from '../adapters/job-source-adapter.interface';
import type { ParsedJob } from '../scraper.types';
import { parseExperience, parseJobType } from './experience.parser';
import { parseLocation } from './location.parser';
import { resolveSalary } from './salary.parser';
import { detectVisaSponsorship, extractBenefits, extractSkills } from './skills.parser';
import { canonicalizeCompanyName, cleanUrl, htmlToText, normalizeWhitespace, slugify } from './text.util';

/**
 * Stage 2 of the pipeline: turns a source-shaped RawJob into the platform's
 * canonical ParsedJob. Every source therefore produces identical semantics for
 * salary, location, seniority, and skills — the reason search/filters can be
 * source-agnostic.
 */
@Injectable()
export class JobParserService {
  parse(raw: RawJob): ParsedJob {
    const title = normalizeWhitespace(raw.title ?? '');
    const companyName = normalizeWhitespace(raw.companyName ?? '');

    const description =
      raw.descriptionText?.trim() ||
      (raw.descriptionHtml ? htmlToText(raw.descriptionHtml) : '') ||
      '';

    const location = parseLocation(raw.locationText, {
      isRemote: raw.isRemote,
      workplaceType: raw.workplaceType,
    });

    const experience = parseExperience(title, description);

    const salary = resolveSalary({
      min: raw.salaryMin ?? null,
      max: raw.salaryMax ?? null,
      currency: raw.salaryCurrency ?? null,
      text: raw.salaryText ?? null,
      interval: raw.salaryText ?? null,
    });

    // Fall back to scanning the description when the source exposes no salary fields.
    const salaryFromDescription =
      salary.min === null && salary.max === null
        ? resolveSalary({ text: findSalarySnippet(description) })
        : salary;

    const tags = dedupeStrings([...(raw.tags ?? []), raw.department ?? ''].filter(Boolean));

    return {
      sourceJobId: raw.sourceJobId,
      title,
      companyName,
      companySlug: slugify(canonicalizeCompanyName(companyName) || companyName),
      companyWebsite: raw.companyWebsite ?? null,
      companyLogoUrl: raw.companyLogoUrl ?? null,
      description,
      descriptionHtml: raw.descriptionHtml ?? null,
      location: location.location,
      city: location.city,
      region: location.region,
      country: location.country,
      isRemote: location.isRemote,
      workModel: location.workModel,
      jobType: parseJobType(raw.employmentType, title),
      experienceLevel: experience.level,
      minYearsExperience: experience.minYears,
      skills: extractSkills({ title, description, tags }),
      benefits: extractBenefits(description),
      salaryMin: salaryFromDescription.min,
      salaryMax: salaryFromDescription.max,
      salaryCurrency: salaryFromDescription.currency,
      salaryPeriod: salaryFromDescription.period,
      salaryText: salaryFromDescription.text ?? raw.salaryText ?? null,
      visaSponsorship: detectVisaSponsorship(description),
      postedAt: raw.postedAt ?? null,
      url: cleanUrl(raw.url),
      applyUrl: raw.applyUrl ? cleanUrl(raw.applyUrl) : null,
      tags,
    };
  }

  parseMany(rawJobs: RawJob[]): ParsedJob[] {
    return rawJobs.map((raw) => this.parse(raw));
  }
}

/**
 * Isolates the sentence most likely to contain compensation, so the salary parser
 * never reads unrelated numbers (headcount, founding year, ...) from a long description.
 */
function findSalarySnippet(description: string): string | null {
  if (!description) {
    return null;
  }
  const lines = description.split(/\n|(?<=\.)\s/);
  const candidate = lines.find((line) =>
    /(salary|compensation|base pay|pay range|salary range|\$\s?\d|€\s?\d|£\s?\d)/i.test(line),
  );
  return candidate ? candidate.slice(0, 240) : null;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))];
}
