'use client';

import * as React from 'react';
import Link from 'next/link';
import { Lock, RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  ExperienceLevel,
  JobType,
  type JobFacets,
  type JobSearchQuery,
} from '@ai-career/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { humanizeEnum } from '@/lib/format';

export interface JobFiltersProps {
  value: JobSearchQuery;
  facets?: JobFacets;
  /** Whether the caller's plan unlocks skills/visa filters. */
  hasAdvancedFilters: boolean;
  onChange: (next: JobSearchQuery) => void;
  onReset: () => void;
}

const SALARY_STEPS = [0, 50_000, 80_000, 100_000, 130_000, 160_000, 200_000];

export function JobFilters({
  value,
  facets,
  hasAdvancedFilters,
  onChange,
  onReset,
}: JobFiltersProps) {
  const [skillsInput, setSkillsInput] = React.useState((value.skills ?? []).join(', '));

  const toggleArrayValue = <T extends string>(
    current: T[] | undefined,
    entry: T,
    checked: boolean,
  ): T[] | undefined => {
    const set = new Set(current ?? []);
    if (checked) {
      set.add(entry);
    } else {
      set.delete(entry);
    }
    const next = [...set];
    return next.length > 0 ? next : undefined;
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Reset
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Work setup</legend>
          <CheckboxField
            label="Remote only"
            hint={facets ? `${facets.remoteCount} remote roles` : undefined}
            checked={value.isRemote === true}
            onChange={(event) =>
              onChange({ ...value, isRemote: event.target.checked ? true : undefined })
            }
          />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Job type</legend>
          {Object.values(JobType).map((jobType) => (
            <CheckboxField
              key={jobType}
              label={humanizeEnum(jobType)}
              hint={facets?.byJobType[jobType] ? `${facets.byJobType[jobType]} jobs` : undefined}
              checked={(value.jobTypes ?? []).includes(jobType)}
              onChange={(event) =>
                onChange({
                  ...value,
                  jobTypes: toggleArrayValue(value.jobTypes, jobType, event.target.checked),
                })
              }
            />
          ))}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Experience</legend>
          {Object.values(ExperienceLevel).map((level) => (
            <CheckboxField
              key={level}
              label={humanizeEnum(level)}
              hint={
                facets?.byExperienceLevel[level] ? `${facets.byExperienceLevel[level]} jobs` : undefined
              }
              checked={(value.experienceLevels ?? []).includes(level)}
              onChange={(event) =>
                onChange({
                  ...value,
                  experienceLevels: toggleArrayValue(
                    value.experienceLevels,
                    level,
                    event.target.checked,
                  ),
                })
              }
            />
          ))}
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="salary-min">Minimum salary (yearly)</Label>
          <input
            id="salary-min"
            type="range"
            min={0}
            max={SALARY_STEPS.length - 1}
            step={1}
            value={Math.max(
              0,
              SALARY_STEPS.findIndex((step) => step === (value.salaryMin ?? 0)),
            )}
            onChange={(event) => {
              const step = SALARY_STEPS[Number(event.target.value)] ?? 0;
              onChange({ ...value, salaryMin: step === 0 ? undefined : step });
            }}
            className="w-full accent-primary"
            aria-valuetext={
              value.salaryMin ? `${value.salaryMin.toLocaleString()} per year` : 'Any salary'
            }
          />
          <p className="text-xs text-muted-foreground">
            {value.salaryMin ? `From $${value.salaryMin.toLocaleString()}/yr` : 'Any salary'}
            {facets ? ` · ${facets.withSalaryCount} listings disclose pay` : ''}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location-filter">Location</Label>
          <Input
            id="location-filter"
            placeholder="City or country"
            defaultValue={value.location ?? ''}
            onBlur={(event) =>
              onChange({ ...value, location: event.target.value.trim() || undefined })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="posted-within">Posted within</Label>
          <div className="flex flex-wrap gap-1.5">
            {[1, 3, 7, 30].map((days) => (
              <Button
                key={days}
                type="button"
                size="sm"
                variant={value.postedWithinDays === days ? 'default' : 'outline'}
                onClick={() =>
                  onChange({
                    ...value,
                    postedWithinDays: value.postedWithinDays === days ? undefined : days,
                  })
                }
              >
                {days === 1 ? '24h' : `${days}d`}
              </Button>
            ))}
          </div>
        </div>

        {/* Advanced filters are a paid capability; the API rejects them otherwise. */}
        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Advanced filters</span>
            {hasAdvancedFilters ? (
              <Badge variant="success">Unlocked</Badge>
            ) : (
              <Badge variant="premium" className="gap-1">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Pro
              </Badge>
            )}
          </div>

          {hasAdvancedFilters ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="skills-filter">Skills (comma separated)</Label>
                <Input
                  id="skills-filter"
                  placeholder="TypeScript, React"
                  value={skillsInput}
                  onChange={(event) => setSkillsInput(event.target.value)}
                  onBlur={() => {
                    const skills = skillsInput
                      .split(',')
                      .map((skill) => skill.trim())
                      .filter(Boolean);
                    onChange({ ...value, skills: skills.length > 0 ? skills : undefined });
                  }}
                />
              </div>
              <CheckboxField
                label="Offers visa sponsorship"
                checked={value.visaSponsorship === true}
                onChange={(event) =>
                  onChange({
                    ...value,
                    visaSponsorship: event.target.checked ? true : undefined,
                  })
                }
              />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Filter by skills and visa sponsorship, plus{' '}
              <Link href="/pricing" className="text-primary underline">
                early access to new jobs
              </Link>
              .
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
