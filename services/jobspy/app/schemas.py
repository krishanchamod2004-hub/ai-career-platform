"""Request/response contracts for the JobSpy sidecar.

`RawJobOut` mirrors the `RawJob` interface in
`apps/api/src/modules/scraper/adapters/job-source-adapter.interface.ts`, so the
NestJS adapter can hand the payload straight to the existing parse → clean →
dedupe → ingest pipeline without a bespoke normalizer.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class JobSite(str, Enum):
    """Job boards this service exposes.

    Values are the identifiers JobSpy's `site_name` parameter expects.
    """

    LINKEDIN = "linkedin"
    INDEED = "indeed"
    GLASSDOOR = "glassdoor"
    ZIP_RECRUITER = "zip_recruiter"


class JobTypeFilter(str, Enum):
    FULLTIME = "fulltime"
    PARTTIME = "parttime"
    INTERNSHIP = "internship"
    CONTRACT = "contract"


class SearchJobsRequest(BaseModel):
    model_config = {"extra": "forbid"}

    search_term: str = Field(min_length=1, max_length=250)
    location: str | None = Field(default=None, max_length=250)
    sites: list[JobSite] = Field(default_factory=lambda: [JobSite.INDEED])

    results_wanted: int | None = Field(default=None, ge=1)
    #: Miles around `location`.
    distance: int | None = Field(default=None, ge=0, le=200)
    job_type: JobTypeFilter | None = None
    is_remote: bool | None = None
    hours_old: int | None = Field(default=None, ge=1, le=24 * 30)
    offset: int | None = Field(default=None, ge=0)

    #: Required by Indeed and Glassdoor; ignored by LinkedIn and ZipRecruiter.
    country_indeed: str = Field(default="USA", max_length=60)

    @field_validator("sites")
    @classmethod
    def _require_sites(cls, value: list[JobSite]) -> list[JobSite]:
        if not value:
            raise ValueError("at least one site is required")
        # Preserve order while removing duplicates — a repeated site would just
        # double the request volume against the same board.
        return list(dict.fromkeys(value))

    @model_validator(mode="after")
    def _check_incompatible_filters(self) -> SearchJobsRequest:
        """Reject filter combinations the upstream boards silently drop.

        Per JobSpy's documented limitations, Indeed accepts only ONE of
        `hours_old`, `job_type`/`is_remote`, or `easy_apply` per search, and
        LinkedIn only one of `hours_old` or `easy_apply`. Sending both makes the
        board ignore one filter, which looks like a bug in our own code later.
        """
        if self.hours_old is None:
            return self

        conflicting = [
            name
            for name, value in (("job_type", self.job_type), ("is_remote", self.is_remote))
            if value is not None
        ]
        blocked = {JobSite.INDEED, JobSite.GLASSDOOR, JobSite.LINKEDIN} & set(self.sites)
        if conflicting and blocked:
            raise ValueError(
                "hours_old cannot be combined with "
                f"{' or '.join(conflicting)} for {', '.join(sorted(s.value for s in blocked))}: "
                "these boards accept only one of those filters per search"
            )
        return self


class RawJobOut(BaseModel):
    """One posting, shaped like the Node `RawJob` contract."""

    #: Which board produced the row; the NestJS adapter maps it to JobSourceType.
    site: str

    sourceJobId: str
    title: str
    companyName: str
    url: str

    companyWebsite: str | None = None
    companyLogoUrl: str | None = None
    descriptionHtml: str | None = None
    descriptionText: str | None = None
    locationText: str | None = None
    isRemote: bool | None = None
    employmentType: str | None = None
    workplaceType: str | None = None
    department: str | None = None
    salaryText: str | None = None
    salaryMin: int | None = None
    salaryMax: int | None = None
    salaryCurrency: str | None = None
    #: ISO-8601; `new Date(...)` on the Node side.
    postedAt: str | None = None
    applyUrl: str | None = None
    tags: list[str] = Field(default_factory=list)


class SearchJobsResponse(BaseModel):
    jobs: list[RawJobOut]
    #: Rows returned per site, for observability of partial failures.
    countsBySite: dict[str, int]
    total: int
    elapsedMs: int
    #: Rows JobSpy returned that were unusable (missing title/company/url).
    skipped: int
    warnings: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    version: str
    jobspyVersion: str | None = None
    proxiesConfigured: int
    sites: list[str]


class ErrorResponse(BaseModel):
    detail: str
    context: dict[str, Any] | None = None
