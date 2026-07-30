import { ExperienceLevel, JobType, WorkLocationType } from '@ai-career/shared';
import { parseLocation } from '../src/modules/scraper/parsers/location.parser';
import { parseExperience, parseJobType } from '../src/modules/scraper/parsers/experience.parser';

describe('parseLocation', () => {
  it('classifies a plain remote listing', () => {
    const result = parseLocation('Remote');
    expect(result.isRemote).toBe(true);
    expect(result.workModel).toBe(WorkLocationType.REMOTE);
    expect(result.city).toBeNull();
  });

  it('splits a US city/state pair and infers the country', () => {
    const result = parseLocation('Austin, TX');
    expect(result.city).toBe('Austin');
    expect(result.region).toBe('TX');
    expect(result.country).toBe('United States');
    expect(result.isRemote).toBe(false);
    expect(result.workModel).toBe(WorkLocationType.ONSITE);
  });

  it('reads a city/country pair', () => {
    const result = parseLocation('London, United Kingdom');
    expect(result.city).toBe('London');
    expect(result.country).toBe('United Kingdom');
  });

  it('strips remote qualifiers before parsing geography', () => {
    const result = parseLocation('Remote - Germany');
    expect(result.isRemote).toBe(true);
    expect(result.country).toBe('Germany');
  });

  it('prefers a hybrid classification when stated', () => {
    const result = parseLocation('Berlin (Hybrid)', { workplaceType: 'hybrid' });
    expect(result.workModel).toBe(WorkLocationType.HYBRID);
    expect(result.city).toBe('Berlin');
  });

  it('trusts an explicit isRemote hint from the source', () => {
    const result = parseLocation('New York', { isRemote: true });
    expect(result.isRemote).toBe(true);
  });

  it('handles missing location data', () => {
    const result = parseLocation(null);
    expect(result).toMatchObject({ location: null, city: null, isRemote: false });
  });
});

describe('parseExperience', () => {
  it('reads seniority from the title', () => {
    expect(parseExperience('Senior Backend Engineer').level).toBe(ExperienceLevel.SENIOR);
  });

  it('prefers the most specific title marker', () => {
    expect(parseExperience('Principal Software Architect').level).toBe(ExperienceLevel.PRINCIPAL);
    expect(parseExperience('Head of Engineering').level).toBe(ExperienceLevel.EXECUTIVE);
    expect(parseExperience('Engineering Intern').level).toBe(ExperienceLevel.INTERNSHIP);
  });

  it('extracts a minimum years requirement from the description', () => {
    const result = parseExperience(
      'Software Engineer',
      'We require 5+ years of professional experience with distributed systems.',
    );
    expect(result.minYears).toBe(5);
  });

  it('derives a level from stated years when the title has no marker', () => {
    const result = parseExperience('Software Engineer', 'Minimum of 8 years building web apps.');
    expect(result.minYears).toBe(8);
    expect(result.level).toBe(ExperienceLevel.SENIOR);
  });

  it('returns nulls when nothing is stated', () => {
    expect(parseExperience('Software Engineer', 'Join our team.')).toEqual({
      level: null,
      minYears: null,
    });
  });
});

describe('parseJobType', () => {
  it.each([
    ['Full-time', JobType.FULL_TIME],
    ['Part time', JobType.PART_TIME],
    ['Contract', JobType.CONTRACT],
    ['Internship', JobType.INTERNSHIP],
    ['Freelance', JobType.FREELANCE],
  ])('maps "%s"', (input, expected) => {
    expect(parseJobType(input)).toBe(expected);
  });

  it('falls back to the title when the source omits the type', () => {
    expect(parseJobType(null, 'Marketing Internship')).toBe(JobType.INTERNSHIP);
  });

  it('returns null when unknown', () => {
    expect(parseJobType(null, null)).toBeNull();
  });
});
