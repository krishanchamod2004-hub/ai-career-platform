"""Service configuration, loaded from the environment (and an optional .env)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All settings are read from ``JOBSPY_*`` environment variables.

    Comma-separated strings are used instead of ``list[str]`` fields on purpose:
    pydantic-settings parses complex types as JSON, which makes a plain
    ``JOBSPY_PROXIES=host:port,host:port`` value fail at startup.
    """

    model_config = SettingsConfigDict(
        env_prefix="JOBSPY_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- transport -----------------------------------------------------------
    # Loopback by default: this service has no user model of its own and is meant
    # to sit behind the NestJS API, not on a public interface.
    host: str = "127.0.0.1"
    port: int = 8000

    #: Shared secret the NestJS API must send as `X-JobSpy-Token`. When empty the
    #: service refuses to start unless `allow_insecure` is explicitly set.
    api_token: str = ""
    allow_insecure: bool = False

    # --- scraping ------------------------------------------------------------
    #: Comma-separated proxies, each `user:pass@host:port`, `host:port`, or
    #: `localhost`. JobSpy round-robins through them per job board.
    #: LinkedIn rate-limits aggressively from a single IP, so populate this
    #: before running LinkedIn searches at any volume.
    proxies: str = ""

    #: Path to a CA certificate bundle, required by some MITM proxy vendors.
    ca_cert: str = ""

    #: Override JobSpy's built-in User-Agent (theirs goes stale between releases).
    user_agent: str = ""

    #: `html` maps the description onto RawJob.descriptionHtml (the Node parser
    #: converts HTML to text); `markdown` maps onto RawJob.descriptionText.
    description_format: str = "html"

    #: LinkedIn omits descriptions from search results; fetching them costs one
    #: extra request per posting but is required for AI evaluation to work.
    linkedin_fetch_description: bool = True

    #: Convert hourly/weekly/monthly pay to an annual figure.
    enforce_annual_salary: bool = False

    #: JobSpy log verbosity: 0 errors, 1 errors+warnings, 2 everything.
    verbose: int = 1

    # --- limits --------------------------------------------------------------
    default_results_wanted: int = 25
    #: Hard ceiling per site. Job boards cap a single search around 1000 results
    #: and every extra page raises the odds of a 429.
    max_results_wanted: int = 100

    #: Concurrent scrape_jobs() calls. Each call already fans out across sites
    #: internally, so keep this low to stay under the boards' rate limits.
    max_concurrency: int = 2

    #: Upper bound on a single search before the caller gets a 504.
    request_timeout_seconds: int = 180

    @property
    def proxy_list(self) -> list[str] | None:
        """JobSpy expects a list or ``None`` — never an empty list."""
        entries = [item.strip() for item in self.proxies.split(",") if item.strip()]
        return entries or None

    @property
    def ca_cert_path(self) -> str | None:
        return self.ca_cert.strip() or None

    @property
    def user_agent_value(self) -> str | None:
        return self.user_agent.strip() or None


@lru_cache
def get_settings() -> Settings:
    return Settings()
