"""
Tests for Lead Ingestion Service
==================================
Phone normalization, name splitting, normalizers (IndiaMart, JustDial, Facebook),
deduplication, and full ingestion flow.
"""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

from api.services.lead_ingestion_service import (
    normalize_phone,
    split_name,
    normalize_indiamart_lead,
    normalize_justdial_lead,
    normalize_facebook_lead,
    find_duplicate_lead,
    ingest_lead,
)
from api.models.crm import Lead, LeadSource, LeadStatus


# ── Phone Normalization ──────────────────────────────────────────


class TestNormalizePhone:
    def test_ten_digit(self):
        assert normalize_phone("9876543210") == "9876543210"

    def test_plus91_prefix(self):
        assert normalize_phone("+919876543210") == "9876543210"

    def test_91_prefix(self):
        assert normalize_phone("919876543210") == "9876543210"

    def test_zero_prefix(self):
        assert normalize_phone("09876543210") == "9876543210"

    def test_with_spaces_and_dashes(self):
        assert normalize_phone("+91 98765-43210") == "9876543210"

    def test_empty(self):
        assert normalize_phone("") == ""

    def test_short_number(self):
        result = normalize_phone("12345")
        assert result == "12345"

    def test_with_parentheses(self):
        assert normalize_phone("+91(987)654-3210") == "9876543210"


# ── Name Splitting ───────────────────────────────────────────────


class TestSplitName:
    def test_full_name(self):
        assert split_name("Rajesh Kumar") == ("Rajesh", "Kumar")

    def test_single_name(self):
        assert split_name("Rajesh") == ("Rajesh", "")

    def test_three_part_name(self):
        assert split_name("Rajesh Kumar Singh") == ("Rajesh", "Kumar Singh")

    def test_empty(self):
        assert split_name("") == ("", "")

    def test_whitespace(self):
        # .strip().split(None, 1) collapses whitespace
        assert split_name("  Rajesh  Kumar  ") == ("Rajesh", "Kumar")


# ── IndiaMart Normalizer ────────────────────────────────────────


class TestNormalizeIndiamart:
    def test_basic(self):
        raw = {
            "SENDER_NAME": "Rajesh Kumar",
            "SENDER_MOBILE": "+919876543210",
            "SENDER_EMAIL": "rajesh@example.com",
            "SENDER_COMPANY": "Kumar Industries",
            "UNIQUE_QUERY_ID": "QRY123456",
            "QUERY_PRODUCT_NAME": "Steel Pipes",
            "SENDER_CITY": "Mumbai",
            "SENDER_STATE": "Maharashtra",
            "QUERY_MESSAGE": "Need 100 units",
            "DATE_TIME_STAMP": "28-Feb-2026 10:30:00",
        }
        result = normalize_indiamart_lead(raw)
        assert result["first_name"] == "Rajesh"
        assert result["last_name"] == "Kumar"
        assert result["phone"] == "9876543210"
        assert result["email"] == "rajesh@example.com"
        assert result["company_name"] == "Kumar Industries"
        assert result["external_source_id"] == "QRY123456"
        assert result["external_source_type"] == "indiamart"
        assert result["source"] == LeadSource.INDIAMART
        assert result["city"] == "Mumbai"
        assert result["custom_fields"]["product_interest"] == "Steel Pipes"

    def test_missing_fields(self):
        raw = {"SENDER_NAME": "Priya", "SENDER_MOBILE": "9876543210"}
        result = normalize_indiamart_lead(raw)
        assert result["first_name"] == "Priya"
        assert result["last_name"] == ""
        assert result["email"] is None


# ── JustDial Normalizer ─────────────────────────────────────────


class TestNormalizeJustdial:
    def test_basic(self):
        raw = {
            "leadid": "JD789",
            "name": "Meera Patel",
            "mobile": "8765432109",
            "email": "meera@test.com",
            "category": "Plumber",
            "area": "Andheri",
            "city": "Mumbai",
            "date": "2026-02-28",
        }
        result = normalize_justdial_lead(raw)
        assert result["first_name"] == "Meera"
        assert result["last_name"] == "Patel"
        assert result["phone"] == "8765432109"
        assert result["external_source_id"] == "JD789"
        assert result["external_source_type"] == "justdial"
        assert result["source"] == LeadSource.JUSTDIAL
        assert "Plumber" in result["notes"]
        assert result["custom_fields"]["category"] == "Plumber"

    def test_no_email(self):
        raw = {"leadid": "JD100", "name": "Test", "mobile": "1234567890"}
        result = normalize_justdial_lead(raw)
        assert result["email"] is None


# ── Facebook Normalizer ─────────────────────────────────────────


class TestNormalizeFacebook:
    def test_basic(self):
        raw = {
            "id": "FB_LEAD_001",
            "field_data": [
                {"name": "full_name", "values": ["Arun Sharma"]},
                {"name": "phone_number", "values": ["+919988776655"]},
                {"name": "email", "values": ["arun@test.com"]},
                {"name": "company_name", "values": ["Sharma Corp"]},
                {"name": "city", "values": ["Delhi"]},
            ],
        }
        result = normalize_facebook_lead(raw)
        assert result["first_name"] == "Arun"
        assert result["last_name"] == "Sharma"
        assert result["phone"] == "9988776655"
        assert result["email"] == "arun@test.com"
        assert result["company_name"] == "Sharma Corp"
        assert result["external_source_id"] == "FB_LEAD_001"
        assert result["external_source_type"] == "facebook_leads"
        assert result["source"] == LeadSource.FACEBOOK_LEADS

    def test_empty_field_data(self):
        raw = {"id": "FB_LEAD_002", "field_data": []}
        result = normalize_facebook_lead(raw)
        assert result["first_name"] == ""
        assert result["phone"] == ""


# ── Deduplication ────────────────────────────────────────────────


class TestFindDuplicateLead:
    def test_match_by_external_id(self):
        mock_db = MagicMock()
        mock_lead = MagicMock(spec=Lead)
        mock_db.execute.return_value.scalar_one_or_none.return_value = mock_lead

        result = find_duplicate_lead(
            mock_db, user_id=1, phone=None, email=None,
            external_id="QRY123", external_type="indiamart",
        )
        assert result == mock_lead

    def test_match_by_phone(self):
        mock_db = MagicMock()
        mock_lead = MagicMock(spec=Lead)
        # No external_id, so only phone lookup runs — return the lead
        mock_db.execute.return_value.scalar_one_or_none.return_value = mock_lead

        result = find_duplicate_lead(
            mock_db, user_id=1, phone="9876543210", email=None,
            external_id=None, external_type=None,
        )
        assert result == mock_lead

    def test_match_by_email(self):
        mock_db = MagicMock()
        mock_lead = MagicMock(spec=Lead)
        # No external_id or phone, so only email lookup runs — return the lead
        mock_db.execute.return_value.scalar_one_or_none.return_value = mock_lead

        result = find_duplicate_lead(
            mock_db, user_id=1, phone=None, email="test@example.com",
            external_id=None, external_type=None,
        )
        assert result == mock_lead

    def test_no_match(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.scalar_one_or_none.return_value = None

        result = find_duplicate_lead(
            mock_db, user_id=1, phone=None, email=None,
            external_id=None, external_type=None,
        )
        assert result is None


# ── Full Ingestion Flow ─────────────────────────────────────────


class TestIngestLead:
    def test_new_lead_created(self):
        mock_db = MagicMock()
        # find_duplicate returns None (no dupe)
        mock_db.execute.return_value.scalar_one_or_none.return_value = None

        normalized = {
            "first_name": "Test",
            "last_name": "User",
            "phone": "9876543210",
            "email": "test@test.com",
            "company_name": None,
            "city": None,
            "state": None,
            "notes": None,
            "source": LeadSource.INDIAMART,
            "external_source_id": "EXT001",
            "external_source_type": "indiamart",
            "raw_payload": {"key": "value"},
            "custom_fields": {},
        }

        with patch(
            "api.services.lead_ingestion_service.find_duplicate_lead",
            return_value=None,
        ):
            lead, is_new = ingest_lead(mock_db, user_id=1, normalized=normalized)

        assert is_new is True
        assert mock_db.add.called
        assert mock_db.flush.called

    def test_duplicate_skipped(self):
        mock_db = MagicMock()
        existing_lead = MagicMock(spec=Lead)

        normalized = {
            "first_name": "Test",
            "phone": "9876543210",
            "email": None,
            "external_source_id": "EXT001",
            "external_source_type": "indiamart",
        }

        with patch(
            "api.services.lead_ingestion_service.find_duplicate_lead",
            return_value=existing_lead,
        ):
            lead, is_new = ingest_lead(mock_db, user_id=1, normalized=normalized)

        assert is_new is False
        assert lead == existing_lead

    def test_config_stats_updated_on_ingest(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.scalar_one_or_none.return_value = None

        mock_config = MagicMock()
        mock_config.total_ingested = 5
        mock_config.total_duplicates = 2
        mock_config.default_tags = ["indiamart"]
        mock_config.auto_assign = True
        mock_config.assign_to_user_id = 42

        normalized = {
            "first_name": "New",
            "last_name": "Lead",
            "phone": "1234567890",
            "email": None,
            "company_name": None,
            "city": None,
            "state": None,
            "notes": None,
            "source": LeadSource.INDIAMART,
            "external_source_id": "EXT999",
            "external_source_type": "indiamart",
            "raw_payload": {},
            "custom_fields": {},
        }

        with patch(
            "api.services.lead_ingestion_service.find_duplicate_lead",
            return_value=None,
        ):
            lead, is_new = ingest_lead(
                mock_db, user_id=1, normalized=normalized, config=mock_config,
            )

        assert is_new is True
        assert mock_config.total_ingested == 6

    def test_config_stats_updated_on_duplicate(self):
        mock_db = MagicMock()
        existing_lead = MagicMock(spec=Lead)

        mock_config = MagicMock()
        mock_config.total_duplicates = 3

        normalized = {
            "phone": "9876543210",
            "email": None,
            "external_source_id": "EXT001",
            "external_source_type": "indiamart",
        }

        with patch(
            "api.services.lead_ingestion_service.find_duplicate_lead",
            return_value=existing_lead,
        ):
            lead, is_new = ingest_lead(
                mock_db, user_id=1, normalized=normalized, config=mock_config,
            )

        assert is_new is False
        assert mock_config.total_duplicates == 4
