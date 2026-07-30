"""Tests for request validation and `scrape_jobs()` parameter construction."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.schemas import JobSite, SearchJobsRequest
from app.service import JobSpyService


def settings(**overrides) -> Settings:
    base = {
        "api_token": "test-token",
        "proxies": "",
        "default_results_wanted": 25,
        "max_results_wanted": 100,
    }
    base.update(overrides)
    return Settings(**base)


class TestRequestValidation:
    def test_requires_search_term(self):
        with pytest.raises(ValidationError):
            SearchJobsRequest(search_term="")

    def test_rejects_unknown_site(self):
        with pytest.raises(ValidationError):
            SearchJobsRequest(search_term="dev", sites=["monster"])

    def test_rejects_empty_site_list(self):
        with pytest.raises(ValidationError):
            SearchJobsRequest(search_term="dev", sites=[])

    def test_deduplicates_sites(self):
        request = SearchJobsRequest(search_term="dev", sites=["indeed", "indeed", "linkedin"])
        assert request.sites == [JobSite.INDEED, JobSite.LINKEDIN]

    def test_rejects_unknown_fields(self):
        with pytest.raises(ValidationError):
            SearchJobsRequest(search_term="dev", easy_apply=True)

    def test_hours_old_conflicts_with_job_type_on_indeed(self):
        """Indeed accepts only one of hours_old / job_type+is_remote per search."""
        with pytest.raises(ValidationError, match="only one of those filters"):
            SearchJobsRequest(
                search_term="dev", sites=["indeed"], hours_old=72, job_type="fulltime"
            )

    def test_hours_old_conflicts_with_is_remote_on_linkedin(self):
        with pytest.raises(ValidationError, match="only one of those filters"):
            SearchJobsRequest(
                search_term="dev", sites=["linkedin"], hours_old=24, is_remote=True
            )

    def test_hours_old_alone_is_allowed(self):
        request = SearchJobsRequest(search_term="dev", sites=["indeed"], hours_old=72)
        assert request.hours_old == 72

    def test_job_type_without_hours_old_is_allowed(self):
        request = SearchJobsRequest(
            search_term="dev", sites=["indeed"], job_type="contract", is_remote=True
        )
        assert request.job_type.value == "contract"

    def test_zip_recruiter_allows_combination(self):
        """Only Indeed/Glassdoor/LinkedIn carry the restriction."""
        request = SearchJobsRequest(
            search_term="dev", sites=["zip_recruiter"], hours_old=48, is_remote=True
        )
        assert request.sites == [JobSite.ZIP_RECRUITER]


class TestBuildParams:
    def test_maps_core_params(self):
        service = JobSpyService(settings())
        params = service.build_params(
            SearchJobsRequest(
                search_term="python developer",
                location="Bengaluru, India",
                sites=["indeed", "linkedin"],
                results_wanted=10,
                country_indeed="India",
            )
        )
        assert params["site_name"] == ["indeed", "linkedin"]
        assert params["search_term"] == "python developer"
        assert params["location"] == "Bengaluru, India"
        assert params["results_wanted"] == 10
        assert params["country_indeed"] == "India"
        assert params["description_format"] == "html"

    def test_clamps_results_wanted_to_ceiling(self):
        service = JobSpyService(settings(max_results_wanted=50))
        params = service.build_params(SearchJobsRequest(search_term="dev", results_wanted=999))
        assert params["results_wanted"] == 50

    def test_applies_default_results_wanted(self):
        service = JobSpyService(settings(default_results_wanted=7))
        params = service.build_params(SearchJobsRequest(search_term="dev"))
        assert params["results_wanted"] == 7

    def test_omits_unset_optional_filters(self):
        """`distance=None` would override JobSpy's own 50-mile default."""
        service = JobSpyService(settings())
        params = service.build_params(SearchJobsRequest(search_term="dev"))
        for key in ("distance", "job_type", "is_remote", "hours_old", "offset", "location"):
            assert key not in params

    def test_forwards_proxies_from_env(self):
        service = JobSpyService(settings(proxies="user:pass@host:1234, 10.0.0.1:8080 ,localhost"))
        params = service.build_params(SearchJobsRequest(search_term="dev"))
        assert params["proxies"] == ["user:pass@host:1234", "10.0.0.1:8080", "localhost"]

    def test_omits_proxies_when_unset(self):
        service = JobSpyService(settings(proxies=""))
        params = service.build_params(SearchJobsRequest(search_term="dev"))
        assert "proxies" not in params

    def test_forwards_ca_cert_and_user_agent_when_set(self):
        service = JobSpyService(settings(ca_cert="C:/certs/proxy.pem", user_agent="Mozilla/5.0"))
        params = service.build_params(SearchJobsRequest(search_term="dev"))
        assert params["ca_cert"] == "C:/certs/proxy.pem"
        assert params["user_agent"] == "Mozilla/5.0"


class TestSettings:
    def test_proxy_list_is_none_when_empty(self):
        assert settings(proxies="   ").proxy_list is None

    def test_proxy_list_parses_comma_separated(self):
        assert settings(proxies="a:1,b:2").proxy_list == ["a:1", "b:2"]
