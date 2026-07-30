"""Maps JobSpy's pandas output onto the Node `RawJob` contract.

Two things make this non-trivial and worth isolating:

1. JobSpy returns a DataFrame, so absent values arrive as ``NaN``/``NaT`` rather
   than ``None``. Serialising those straight to JSON yields literal ``NaN``,
   which is invalid JSON and blows up the caller's parser.
2. Columns are dropped when every row is empty (``dropna(axis=1, how="all")``
   upstream), so every access has to tolerate a missing key.
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime
from typing import Any, Mapping

import pandas as pd

from .schemas import RawJobOut

#: Columns JobSpy promises in `util.desired_order` that we read here.
REQUIRED_FIELDS = ("title", "company", "job_url")


def clean(value: Any) -> Any | None:
    """Normalise pandas' many flavours of "missing" to ``None``."""
    if value is None:
        return None
    # pd.isna returns an array for list-likes, so only trust it for scalars.
    if not isinstance(value, (list, tuple, set, dict)):
        try:
            if pd.isna(value):
                return None
        except (TypeError, ValueError):
            pass
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


def as_text(value: Any) -> str | None:
    cleaned = clean(value)
    if cleaned is None:
        return None
    return str(cleaned).strip() or None


def as_bool(value: Any) -> bool | None:
    cleaned = clean(value)
    if cleaned is None:
        return None
    if isinstance(cleaned, bool):
        return cleaned
    if isinstance(cleaned, (int, float)):
        return bool(cleaned)
    lowered = str(cleaned).strip().lower()
    if lowered in {"true", "t", "yes", "y", "1"}:
        return True
    if lowered in {"false", "f", "no", "n", "0"}:
        return False
    return None


def as_int(value: Any) -> int | None:
    """Salary amounts arrive as floats; drop zero/negative as not-a-salary."""
    cleaned = clean(value)
    if cleaned is None:
        return None
    try:
        number = float(cleaned)
    except (TypeError, ValueError):
        return None
    if number <= 0:
        return None
    return int(round(number))


def as_iso(value: Any) -> str | None:
    cleaned = clean(value)
    if cleaned is None:
        return None
    if isinstance(cleaned, datetime):
        return cleaned.isoformat()
    if isinstance(cleaned, date):
        # Midnight UTC keeps `new Date(...)` on the Node side deterministic.
        return datetime(cleaned.year, cleaned.month, cleaned.day).isoformat()
    text = str(cleaned).strip()
    if not text:
        return None
    try:
        return pd.Timestamp(text).to_pydatetime().isoformat()
    except (ValueError, TypeError):
        return None


def build_salary_text(row: Mapping[str, Any]) -> str | None:
    """Compose a human-readable salary string for the Node salary parser.

    The structured min/max/currency fields are passed through separately; this
    string carries the pay *period*, which `RawJob` has no dedicated field for.
    """
    minimum = as_int(row.get("min_amount"))
    maximum = as_int(row.get("max_amount"))
    if minimum is None and maximum is None:
        return None

    currency = as_text(row.get("currency")) or "USD"
    interval = as_text(row.get("interval"))

    if minimum is not None and maximum is not None and minimum != maximum:
        amount = f"{minimum:,} - {maximum:,}"
    else:
        amount = f"{minimum if minimum is not None else maximum:,}"

    if interval:
        return f"{amount} {currency} {interval}"
    return f"{amount} {currency}"


def build_tags(row: Mapping[str, Any]) -> list[str]:
    tags: list[str] = []
    for key in ("job_level", "company_industry"):
        value = as_text(row.get(key))
        if value:
            tags.append(value)
    # naukri-style comma-joined skills; harmless for the four supported boards.
    skills = as_text(row.get("skills"))
    if skills:
        tags.extend(part.strip() for part in skills.split(",") if part.strip())
    # De-duplicate case-insensitively, preserving first occurrence.
    seen: set[str] = set()
    unique: list[str] = []
    for tag in tags:
        key = tag.lower()
        if key not in seen:
            seen.add(key)
            unique.append(tag)
    return unique


def build_source_job_id(row: Mapping[str, Any], site: str, url: str) -> str:
    """Stable per-source id, matching the `<source>:<...>` style of the existing adapters."""
    identifier = as_text(row.get("id"))
    if identifier:
        return f"{site}:{identifier}"
    # No id (board-dependent): hash the canonical URL so re-runs upsert instead
    # of inserting duplicates.
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
    return f"{site}:url-{digest}"


def map_row(row: Mapping[str, Any], description_format: str = "html") -> RawJobOut | None:
    """Convert one DataFrame row. Returns ``None`` when the row is unusable."""
    title = as_text(row.get("title"))
    company = as_text(row.get("company"))
    url = as_text(row.get("job_url"))
    if not title or not company or not url:
        return None

    site = as_text(row.get("site")) or "unknown"
    description = as_text(row.get("description"))
    is_remote = as_bool(row.get("is_remote"))

    return RawJobOut(
        site=site,
        sourceJobId=build_source_job_id(row, site, url),
        title=title,
        companyName=company,
        url=url,
        applyUrl=as_text(row.get("job_url_direct")) or url,
        companyWebsite=as_text(row.get("company_url_direct")) or as_text(row.get("company_url")),
        companyLogoUrl=as_text(row.get("company_logo")),
        descriptionHtml=description if description_format == "html" else None,
        descriptionText=description if description_format != "html" else None,
        locationText=as_text(row.get("location")),
        isRemote=is_remote,
        employmentType=as_text(row.get("job_type")),
        # Only assert a workplace type when the board was explicit about it;
        # the Node location parser infers the rest from the description.
        workplaceType="remote" if is_remote else None,
        department=as_text(row.get("job_function")),
        salaryText=build_salary_text(row),
        salaryMin=as_int(row.get("min_amount")),
        salaryMax=as_int(row.get("max_amount")),
        salaryCurrency=as_text(row.get("currency")),
        postedAt=as_iso(row.get("date_posted")),
        tags=build_tags(row),
    )


def map_dataframe(
    frame: pd.DataFrame, description_format: str = "html"
) -> tuple[list[RawJobOut], int]:
    """Map a JobSpy result frame, returning ``(jobs, skipped_count)``."""
    # An empty search returns a DataFrame with no columns at all.
    if frame is None or frame.empty:
        return [], 0

    jobs: list[RawJobOut] = []
    skipped = 0
    for record in frame.to_dict(orient="records"):
        mapped = map_row(record, description_format=description_format)
        if mapped is None:
            skipped += 1
            continue
        jobs.append(mapped)
    return jobs, skipped
