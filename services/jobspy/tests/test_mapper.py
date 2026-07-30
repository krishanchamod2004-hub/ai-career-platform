"""Tests for the JobSpy -> RawJob mapper.

These cover the failure modes that are invisible until production: pandas NaN
leaking into JSON, missing columns, and unusable rows.
"""

from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd
import pytest

from app.mapper import (
    as_bool,
    as_int,
    as_iso,
    build_salary_text,
    build_source_job_id,
    map_dataframe,
    map_row,
)


def base_row(**overrides):
    row = {
        "id": "li-3693012711",
        "site": "linkedin",
        "job_url": "https://www.linkedin.com/jobs/view/3693012711",
        "job_url_direct": "https://careers.acme.com/apply/42",
        "title": "Senior Software Engineer",
        "company": "Acme Corp",
        "location": "Bengaluru, KA, India",
        "date_posted": dt.date(2026, 7, 20),
        "job_type": "fulltime",
        "interval": "yearly",
        "min_amount": 3500000.0,
        "max_amount": 4500000.0,
        "currency": "INR",
        "is_remote": False,
        "job_level": "mid-senior level",
        "job_function": "Engineering",
        "description": "<p>Build things</p>",
        "company_industry": "Software Development",
        "company_url": "https://www.linkedin.com/company/acme",
        "company_logo": "https://media.example.com/acme.png",
    }
    row.update(overrides)
    return row


class TestScalarHelpers:
    @pytest.mark.parametrize("value", [np.nan, None, pd.NA, pd.NaT, "", "   "])
    def test_missing_values_become_none(self, value):
        assert as_int(value) is None
        assert as_bool(value) is None
        assert as_iso(value) is None

    def test_as_int_rejects_non_positive(self):
        assert as_int(0) is None
        assert as_int(-5000) is None
        assert as_int(120000.6) == 120001

    @pytest.mark.parametrize(
        ("raw", "expected"),
        [(True, True), (False, False), ("true", True), ("False", False), (1, True), (0, False)],
    )
    def test_as_bool_variants(self, raw, expected):
        assert as_bool(raw) is expected

    def test_as_iso_from_date_and_string(self):
        assert as_iso(dt.date(2026, 7, 20)) == "2026-07-20T00:00:00"
        assert as_iso("2026-07-20") == "2026-07-20T00:00:00"
        assert as_iso("not a date") is None


class TestSalaryText:
    def test_range_includes_currency_and_interval(self):
        assert build_salary_text(base_row()) == "3,500,000 - 4,500,000 INR yearly"

    def test_single_amount(self):
        row = base_row(min_amount=90000.0, max_amount=np.nan)
        assert build_salary_text(row) == "90,000 INR yearly"

    def test_no_amounts_returns_none(self):
        assert build_salary_text(base_row(min_amount=np.nan, max_amount=np.nan)) is None

    def test_currency_defaults_to_usd(self):
        row = base_row(currency=np.nan)
        assert build_salary_text(row) == "3,500,000 - 4,500,000 USD yearly"


class TestSourceJobId:
    def test_prefers_upstream_id(self):
        row = base_row()
        assert build_source_job_id(row, "linkedin", row["job_url"]) == "linkedin:li-3693012711"

    def test_falls_back_to_stable_url_hash(self):
        row = base_row(id=np.nan)
        first = build_source_job_id(row, "indeed", row["job_url"])
        second = build_source_job_id(row, "indeed", row["job_url"])
        assert first == second
        assert first.startswith("indeed:url-")

    def test_different_urls_hash_differently(self):
        row = base_row(id=np.nan)
        assert build_source_job_id(row, "indeed", "https://a.example") != build_source_job_id(
            row, "indeed", "https://b.example"
        )


class TestMapRow:
    def test_maps_full_row(self):
        job = map_row(base_row())
        assert job is not None
        assert job.title == "Senior Software Engineer"
        assert job.companyName == "Acme Corp"
        assert job.url == "https://www.linkedin.com/jobs/view/3693012711"
        assert job.applyUrl == "https://careers.acme.com/apply/42"
        assert job.descriptionHtml == "<p>Build things</p>"
        assert job.descriptionText is None
        assert job.salaryMin == 3500000
        assert job.salaryMax == 4500000
        assert job.salaryCurrency == "INR"
        assert job.postedAt == "2026-07-20T00:00:00"
        assert job.isRemote is False
        assert job.workplaceType is None
        assert job.department == "Engineering"
        assert job.tags == ["mid-senior level", "Software Development"]

    def test_markdown_format_targets_description_text(self):
        job = map_row(base_row(description="**Build** things"), description_format="markdown")
        assert job is not None
        assert job.descriptionText == "**Build** things"
        assert job.descriptionHtml is None

    def test_remote_sets_workplace_type(self):
        job = map_row(base_row(is_remote=True))
        assert job is not None
        assert job.isRemote is True
        assert job.workplaceType == "remote"

    @pytest.mark.parametrize("field", ["title", "company", "job_url"])
    def test_rows_missing_required_fields_are_dropped(self, field):
        assert map_row(base_row(**{field: np.nan})) is None

    def test_tolerates_missing_columns(self):
        """JobSpy drops all-empty columns, so keys can be absent entirely."""
        minimal = {
            "site": "indeed",
            "title": "QA Engineer",
            "company": "Globex",
            "job_url": "https://indeed.com/viewjob?jk=1",
        }
        job = map_row(minimal)
        assert job is not None
        assert job.salaryMin is None
        assert job.postedAt is None
        assert job.tags == []
        assert job.applyUrl == "https://indeed.com/viewjob?jk=1"

    def test_no_nan_survives_serialisation(self):
        row = {key: np.nan for key in base_row()}
        row.update(
            {
                "site": "glassdoor",
                "title": "Data Analyst",
                "company": "Initech",
                "job_url": "https://glassdoor.com/job/1",
            }
        )
        job = map_row(row)
        assert job is not None
        assert "NaN" not in job.model_dump_json()


class TestMapDataFrame:
    def test_empty_frame(self):
        jobs, skipped = map_dataframe(pd.DataFrame())
        assert jobs == []
        assert skipped == 0

    def test_counts_skipped_rows(self):
        frame = pd.DataFrame([base_row(), base_row(title=np.nan)])
        jobs, skipped = map_dataframe(frame)
        assert len(jobs) == 1
        assert skipped == 1

    def test_dataframe_nan_becomes_none(self):
        """A column present but empty for one row arrives as NaN via pandas."""
        frame = pd.DataFrame([base_row(), base_row(id="in-2", site="indeed", min_amount=None)])
        jobs, _ = map_dataframe(frame)
        assert jobs[1].salaryMin is None
        assert "NaN" not in jobs[1].model_dump_json()
