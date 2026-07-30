"""Runs JobSpy searches off the event loop and maps the result.

`scrape_jobs()` is blocking and internally fans out with its own thread pool, so
it is executed via `asyncio.to_thread` behind a semaphore. Without the semaphore,
concurrent HTTP requests would multiply the outbound request rate and get the
IP blocked by the job boards — the failure mode JobSpy's docs warn about.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from jobspy import scrape_jobs

from .config import Settings
from .mapper import map_dataframe
from .schemas import SearchJobsRequest, SearchJobsResponse

logger = logging.getLogger(__name__)


class ScrapeTimeoutError(Exception):
    """Raised when a search exceeds `JOBSPY_REQUEST_TIMEOUT_SECONDS`."""


class ScrapeFailedError(Exception):
    """Raised when JobSpy itself raises (blocked, network down, bad params)."""


class JobSpyService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._semaphore = asyncio.Semaphore(max(1, settings.max_concurrency))

    def build_params(self, request: SearchJobsRequest) -> dict[str, Any]:
        """Translate our request model into `scrape_jobs()` keyword arguments."""
        settings = self._settings
        results_wanted = min(
            request.results_wanted or settings.default_results_wanted,
            settings.max_results_wanted,
        )

        params: dict[str, Any] = {
            "site_name": [site.value for site in request.sites],
            "search_term": request.search_term,
            "results_wanted": results_wanted,
            "country_indeed": request.country_indeed,
            "description_format": settings.description_format,
            "linkedin_fetch_description": settings.linkedin_fetch_description,
            "enforce_annual_salary": settings.enforce_annual_salary,
            "verbose": settings.verbose,
        }

        # Only forward optional filters that were actually supplied: passing
        # `None` for `job_type`/`is_remote` is fine, but passing `distance=None`
        # would override JobSpy's own default of 50 miles.
        if request.location:
            params["location"] = request.location
        if request.distance is not None:
            params["distance"] = request.distance
        if request.job_type is not None:
            params["job_type"] = request.job_type.value
        if request.is_remote is not None:
            params["is_remote"] = request.is_remote
        if request.hours_old is not None:
            params["hours_old"] = request.hours_old
        if request.offset is not None:
            params["offset"] = request.offset

        if settings.proxy_list:
            params["proxies"] = settings.proxy_list
        if settings.ca_cert_path:
            params["ca_cert"] = settings.ca_cert_path
        if settings.user_agent_value:
            params["user_agent"] = settings.user_agent_value

        return params

    async def search(self, request: SearchJobsRequest) -> SearchJobsResponse:
        params = self.build_params(request)
        started = time.perf_counter()

        async with self._semaphore:
            try:
                frame = await asyncio.wait_for(
                    asyncio.to_thread(scrape_jobs, **params),
                    timeout=self._settings.request_timeout_seconds,
                )
            except asyncio.TimeoutError as error:
                raise ScrapeTimeoutError(
                    f"search exceeded {self._settings.request_timeout_seconds}s"
                ) from error
            except Exception as error:  # noqa: BLE001 - JobSpy raises bare Exceptions
                logger.exception("scrape_jobs failed")
                raise ScrapeFailedError(str(error) or error.__class__.__name__) from error

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        jobs, skipped = map_dataframe(frame, self._settings.description_format)

        counts: dict[str, int] = {site.value: 0 for site in request.sites}
        for job in jobs:
            counts[job.site] = counts.get(job.site, 0) + 1

        warnings: list[str] = []
        empty_sites = [site for site, count in counts.items() if count == 0]
        if empty_sites:
            # Almost always a 429/IP block rather than a genuinely empty board.
            warnings.append(
                "no results from: "
                + ", ".join(sorted(empty_sites))
                + " (possible rate limit or IP block; consider JOBSPY_PROXIES)"
            )
        if skipped:
            warnings.append(f"{skipped} row(s) skipped for missing title/company/url")

        return SearchJobsResponse(
            jobs=jobs,
            countsBySite=counts,
            total=len(jobs),
            elapsedMs=elapsed_ms,
            skipped=skipped,
            warnings=warnings,
        )


def jobspy_version() -> str | None:
    try:
        from importlib.metadata import version

        return version("python-jobspy")
    except Exception:  # noqa: BLE001
        return None


__all__ = [
    "JobSpyService",
    "ScrapeFailedError",
    "ScrapeTimeoutError",
    "jobspy_version",
]
