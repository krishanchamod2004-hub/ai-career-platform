"""FastAPI application exposing JobSpy to the NestJS API.

Scope is deliberately narrow: fetch and normalise. This service holds no
database credentials and performs no writes — `jobs.description`, `content_hash`,
`dedupe_key` and `slug` are all derived, non-null columns owned by Prisma, and
duplicating that derivation in Python would let the two implementations drift
and produce duplicate rows.
"""

from __future__ import annotations

import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.responses import JSONResponse

from . import __version__
from .config import Settings, get_settings
from .schemas import (
    HealthResponse,
    JobSite,
    SearchJobsRequest,
    SearchJobsResponse,
)
from .service import (
    JobSpyService,
    ScrapeFailedError,
    ScrapeTimeoutError,
    jobspy_version,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
)
logger = logging.getLogger("jobspy.service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    if not settings.api_token and not settings.allow_insecure:
        # Fail fast rather than exposing an unauthenticated scraping endpoint that
        # anyone who can reach the port could use to burn the proxy budget or get
        # the server's IP banned by the job boards.
        raise RuntimeError(
            "JOBSPY_API_TOKEN is not set. Set it to a shared secret (the NestJS API "
            "sends it as X-JobSpy-Token), or set JOBSPY_ALLOW_INSECURE=true to run "
            "without authentication on a trusted loopback interface."
        )
    if not settings.api_token:
        logger.warning(
            "Running WITHOUT authentication (JOBSPY_ALLOW_INSECURE=true). "
            "Bind to 127.0.0.1 only and never expose this port publicly."
        )
    if not settings.proxy_list:
        logger.warning(
            "No JOBSPY_PROXIES configured. LinkedIn typically rate-limits a single "
            "IP within ~10 pages; expect HTTP 429 and empty results at volume."
        )

    app.state.service = JobSpyService(settings)
    logger.info(
        "JobSpy sidecar %s ready (jobspy=%s, sites=%s, max_concurrency=%s)",
        __version__,
        jobspy_version(),
        ",".join(site.value for site in JobSite),
        settings.max_concurrency,
    )
    yield


app = FastAPI(
    title="JobSpy sidecar",
    description=(
        "On-demand job search over LinkedIn, Indeed, Glassdoor and ZipRecruiter. "
        "Returns postings in the RawJob shape used by the NestJS scraper pipeline."
    ),
    version=__version__,
    lifespan=lifespan,
)


async def require_token(
    settings: Settings = Depends(get_settings),
    x_jobspy_token: str | None = Header(default=None, alias="X-JobSpy-Token"),
) -> None:
    """Shared-secret auth. Constant-time compare to avoid leaking the token."""
    if not settings.api_token:
        return
    if not x_jobspy_token or not secrets.compare_digest(x_jobspy_token, settings.api_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing X-JobSpy-Token",
        )


def get_service(settings: Settings = Depends(get_settings)) -> JobSpyService:
    service = getattr(app.state, "service", None)
    if service is None:
        # Only happens if lifespan did not run (e.g. in unit tests) — build lazily.
        service = JobSpyService(settings)
        app.state.service = service
    return service


@app.get("/health", response_model=HealthResponse, tags=["ops"])
async def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=__version__,
        jobspyVersion=jobspy_version(),
        proxiesConfigured=len(settings.proxy_list or []),
        sites=[site.value for site in JobSite],
    )


@app.post(
    "/search-jobs",
    response_model=SearchJobsResponse,
    dependencies=[Depends(require_token)],
    tags=["search"],
    responses={
        401: {"description": "Missing or invalid X-JobSpy-Token"},
        422: {"description": "Invalid filter combination for the requested boards"},
        502: {"description": "JobSpy failed — commonly a 429/IP block upstream"},
        504: {"description": "Search exceeded JOBSPY_REQUEST_TIMEOUT_SECONDS"},
    },
)
async def search_jobs(
    request: SearchJobsRequest,
    service: JobSpyService = Depends(get_service),
) -> SearchJobsResponse:
    logger.info(
        'search "%s" location=%s sites=%s',
        request.search_term,
        request.location or "-",
        ",".join(site.value for site in request.sites),
    )
    try:
        response = await service.search(request)
    except ScrapeTimeoutError as error:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(error))
    except ScrapeFailedError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error))

    logger.info(
        "search returned %s job(s) in %sms %s",
        response.total,
        response.elapsedMs,
        response.countsBySite,
    )
    return response


@app.exception_handler(RuntimeError)
async def runtime_error_handler(_request, error: RuntimeError) -> JSONResponse:
    logger.error("unhandled runtime error: %s", error)
    return JSONResponse(status_code=500, content={"detail": "internal error"})
