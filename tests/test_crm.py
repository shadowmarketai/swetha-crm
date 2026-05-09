"""
Tests for CRM endpoints: Leads, Companies, Contacts, Deals.

All CRM endpoints are under /api/v1/ and require authentication.
CRM entities use the ORM (SQLAlchemy) and the crm_service layer.

Endpoints tested:
- GET/POST    /api/v1/crm-leads
- GET/PUT/DEL /api/v1/crm-leads/{id}
- GET/POST    /api/v1/crm-companies
- GET/PUT/DEL /api/v1/crm-companies/{id}
- GET/POST    /api/v1/crm-contacts
- GET/PUT     /api/v1/crm-contacts/{id}
- GET/POST    /api/v1/crm-deals
- GET/PUT     /api/v1/crm-deals/{id}
- GET         /api/v1/dashboard
"""

import logging

import pytest

logger = logging.getLogger(__name__)

# Previously module-level xfail due to a legacy/ORM schema conflict that
# has since been resolved. As of 2026-05-09 the full CRM test suite (37
# tests) runs green, so the marker has been removed.


# ===========================================================================
# LEADS
# ===========================================================================


@pytest.mark.asyncio
class TestCRMLeads:
    """CRUD tests for /api/v1/crm-leads."""

    async def test_list_leads_empty_or_populated(self, async_client, async_auth_headers):
        """GET /api/v1/crm-leads should return a paginated response."""
        resp = await async_client.get("/api/v1/crm-leads", headers=async_auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    async def test_create_lead(self, async_client, async_auth_headers):
        """POST /api/v1/crm-leads should create a new lead."""
        payload = {
            "first_name": "Ravi",
            "last_name": "Kumar",
            "phone": "+91 9876543210",
            "email": "ravi.kumar@testcorp.in",
            "company": "TestCorp India",
            "source": "Manual",
            "status": "new",
            "lead_score": 50.0,
            "notes": "Test lead from pytest",
            "tags": ["pytest", "test"],
        }
        resp = await async_client.post(
            "/api/v1/crm-leads", json=payload, headers=async_auth_headers,
        )
        assert resp.status_code == 201, f"Create lead failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data["first_name"] == "Ravi"

    async def test_create_lead_missing_first_name(self, async_client, async_auth_headers):
        """Creating a lead without first_name should return 422."""
        resp = await async_client.post("/api/v1/crm-leads", json={
            "phone": "+91 9876543210",
        }, headers=async_auth_headers)
        assert resp.status_code == 422

    async def test_create_lead_invalid_phone(self, async_client, async_auth_headers):
        """Creating a lead with too-short phone should return 422."""
        resp = await async_client.post("/api/v1/crm-leads", json={
            "first_name": "Bad Phone",
            "phone": "12",  # too short
        }, headers=async_auth_headers)
        assert resp.status_code == 422

    async def test_get_lead_by_id(self, async_client, async_auth_headers):
        """Create a lead, then GET it by ID."""
        create_resp = await async_client.post("/api/v1/crm-leads", json={
            "first_name": "GetById",
            "phone": "+91 9000000001",
        }, headers=async_auth_headers)
        if create_resp.status_code != 201:
            pytest.skip("Could not create lead for get-by-id test")
        lead_id = create_resp.json()["id"]

        get_resp = await async_client.get(
            f"/api/v1/crm-leads/{lead_id}", headers=async_auth_headers,
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == lead_id

    async def test_get_lead_not_found(self, async_client, async_auth_headers):
        """GET a non-existent lead should return 404."""
        resp = await async_client.get(
            "/api/v1/crm-leads/999999", headers=async_auth_headers,
        )
        assert resp.status_code == 404

    async def test_update_lead(self, async_client, async_auth_headers):
        """Create a lead, then PUT to update it."""
        create_resp = await async_client.post("/api/v1/crm-leads", json={
            "first_name": "UpdateMe",
            "phone": "+91 9000000002",
            "lead_score": 20.0,
        }, headers=async_auth_headers)
        if create_resp.status_code != 201:
            pytest.skip("Could not create lead for update test")
        lead_id = create_resp.json()["id"]

        put_resp = await async_client.put(
            f"/api/v1/crm-leads/{lead_id}",
            json={"lead_score": 85.0, "status": "qualified"},
            headers=async_auth_headers,
        )
        assert put_resp.status_code == 200
        updated = put_resp.json()
        assert float(updated.get("lead_score", 0)) == 85.0

    async def test_update_lead_not_found(self, async_client, async_auth_headers):
        """PUT to a non-existent lead should return 404."""
        resp = await async_client.put(
            "/api/v1/crm-leads/999999",
            json={"lead_score": 50.0},
            headers=async_auth_headers,
        )
        assert resp.status_code == 404

    async def test_delete_lead(self, async_client, async_auth_headers):
        """Create a lead, then DELETE it (soft-delete)."""
        create_resp = await async_client.post("/api/v1/crm-leads", json={
            "first_name": "DeleteMe",
            "phone": "+91 9000000003",
        }, headers=async_auth_headers)
        if create_resp.status_code != 201:
            pytest.skip("Could not create lead for delete test")
        lead_id = create_resp.json()["id"]

        del_resp = await async_client.delete(
            f"/api/v1/crm-leads/{lead_id}", headers=async_auth_headers,
        )
        assert del_resp.status_code == 200
        assert del_resp.json().get("success", True) is True

        # After deletion, GET should return 404
        get_resp = await async_client.get(
            f"/api/v1/crm-leads/{lead_id}", headers=async_auth_headers,
        )
        assert get_resp.status_code == 404

    async def test_delete_lead_not_found(self, async_client, async_auth_headers):
        """DELETE a non-existent lead should return 404."""
        resp = await async_client.delete(
            "/api/v1/crm-leads/999999", headers=async_auth_headers,
        )
        assert resp.status_code == 404

    async def test_list_leads_pagination(self, async_client, async_auth_headers):
        """List leads with skip and limit parameters."""
        resp = await async_client.get(
            "/api/v1/crm-leads?skip=0&limit=5", headers=async_auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["page_size"] == 5
        assert len(data["items"]) <= 5


# ===========================================================================
# COMPANIES
# ===========================================================================


@pytest.mark.asyncio
class TestCRMCompanies:
    """CRUD tests for /api/v1/crm-companies."""

    async def test_list_companies(self, async_client, async_auth_headers):
        """GET /api/v1/crm-companies should return a paginated response."""
        resp = await async_client.get("/api/v1/crm-companies", headers=async_auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data

    async def test_create_company(self, async_client, async_auth_headers):
        """POST /api/v1/crm-companies should create a new company."""
        payload = {
            "name": "TechCorp Solutions Pvt Ltd",
            "email": "info@techcorp.in",
            "phone": "+91 44 2222 3333",
            "website": "https://techcorp.in",
            "industry": "Technology",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "country": "India",
            "gstn": "33AAACT1234F1Z5",
            "notes": "Key technology partner",
        }
        resp = await async_client.post(
            "/api/v1/crm-companies", json=payload, headers=async_auth_headers,
        )
        assert resp.status_code == 201, f"Create company failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data["name"] == payload["name"]

    async def test_create_company_missing_name(self, async_client, async_auth_headers):
        """Creating a company without name should return 422."""
        resp = await async_client.post("/api/v1/crm-companies", json={
            "email": "noname@company.in",
        }, headers=async_auth_headers)
        assert resp.status_code == 422

    async def test_get_company_by_id(self, async_client, async_auth_headers):
        """Create a company, then GET it by ID."""
        create_resp = await async_client.post("/api/v1/crm-companies", json={
            "name": "Get By ID Corp",
            "industry": "Retail",
        }, headers=async_auth_headers)
        if create_resp.status_code != 201:
            pytest.skip("Could not create company")
        company_id = create_resp.json()["id"]

        get_resp = await async_client.get(
            f"/api/v1/crm-companies/{company_id}", headers=async_auth_headers,
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == company_id

    async def test_get_company_not_found(self, async_client, async_auth_headers):
        """GET a non-existent company should return 404."""
        resp = await async_client.get(
            "/api/v1/crm-companies/999999", headers=async_auth_headers,
        )
        assert resp.status_code == 404

    async def test_update_company(self, async_client, async_auth_headers):
        """Create a company, then PUT to update it."""
        create_resp = await async_client.post("/api/v1/crm-companies", json={
            "name": "Update Me Corp",
        }, headers=async_auth_headers)
        if create_resp.status_code != 201:
            pytest.skip("Could not create company")
        company_id = create_resp.json()["id"]

        put_resp = await async_client.put(
            f"/api/v1/crm-companies/{company_id}",
            json={"name": "Updated Corp Name", "industry": "Finance"},
            headers=async_auth_headers,
        )
        assert put_resp.status_code == 200
        assert put_resp.json()["name"] == "Updated Corp Name"

    async def test_update_company_not_found(self, async_client, async_auth_headers):
        """PUT to a non-existent company should return 404."""
        resp = await async_client.put(
            "/api/v1/crm-companies/999999",
            json={"name": "Ghost Corp"},
            headers=async_auth_headers,
        )
        assert resp.status_code == 404

    async def test_delete_company(self, async_client, async_auth_headers):
        """Create a company, then DELETE it (soft-delete)."""
        create_resp = await async_client.post("/api/v1/crm-companies", json={
            "name": "Delete Me Corp",
        }, headers=async_auth_headers)
        if create_resp.status_code != 201:
            pytest.skip("Could not create company")
        company_id = create_resp.json()["id"]

        del_resp = await async_client.delete(
            f"/api/v1/crm-companies/{company_id}", headers=async_auth_headers,
        )
        assert del_resp.status_code == 200

        # Should be 404 after deletion
        get_resp = await async_client.get(
            f"/api/v1/crm-companies/{company_id}", headers=async_auth_headers,
        )
        assert get_resp.status_code == 404

    async def test_delete_company_not_found(self, async_client, async_auth_headers):
        """DELETE a non-existent company should return 404."""
        resp = await async_client.delete(
            "/api/v1/crm-companies/999999", headers=async_auth_headers,
        )
        assert resp.status_code == 404


# ===========================================================================
# CONTACTS
# ===========================================================================


@pytest.mark.asyncio
class TestCRMContacts:
    """CRUD tests for /api/v1/crm-contacts."""

    async def test_list_contacts(self, async_client, async_auth_headers):
        """GET /api/v1/crm-contacts should return a paginated response."""
        resp = await async_client.get("/api/v1/crm-contacts", headers=async_auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data

    async def test_create_contact(self, async_client, async_auth_headers):
        """POST /api/v1/crm-contacts should create a new contact."""
        payload = {
            "first_name": "Priya",
            "last_name": "Sharma",
            "email": "priya.sharma@example.com",
            "phone": "+91 98765 43210",
            "mobile": "+91 98765 43211",
            "designation": "CTO",
            "department": "Engineering",
            "notes": "Key decision maker",
        }
        resp = await async_client.post(
            "/api/v1/crm-contacts", json=payload, headers=async_auth_headers,
        )
        assert resp.status_code == 201, f"Create contact failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data["first_name"] == "Priya"

    async def test_create_contact_missing_first_name(self, async_client, async_auth_headers):
        """Creating a contact without first_name should return 422."""
        resp = await async_client.post("/api/v1/crm-contacts", json={
            "email": "noname@contact.com",
        }, headers=async_auth_headers)
        assert resp.status_code == 422

    async def test_get_contact_by_id(self, async_client, async_auth_headers):
        """Create a contact, then GET it by ID."""
        create_resp = await async_client.post("/api/v1/crm-contacts", json={
            "first_name": "GetContact",
            "phone": "+91 9111222333",
        }, headers=async_auth_headers)
        if create_resp.status_code != 201:
            pytest.skip("Could not create contact")
        contact_id = create_resp.json()["id"]

        get_resp = await async_client.get(
            f"/api/v1/crm-contacts/{contact_id}", headers=async_auth_headers,
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == contact_id

    async def test_get_contact_not_found(self, async_client, async_auth_headers):
        """GET a non-existent contact should return 404."""
        resp = await async_client.get(
            "/api/v1/crm-contacts/999999", headers=async_auth_headers,
        )
        assert resp.status_code == 404

    async def test_update_contact(self, async_client, async_auth_headers):
        """Create a contact, then PUT to update it."""
        create_resp = await async_client.post("/api/v1/crm-contacts", json={
            "first_name": "UpdateContact",
            "phone": "+91 9111222334",
        }, headers=async_auth_headers)
        if create_resp.status_code != 201:
            pytest.skip("Could not create contact")
        contact_id = create_resp.json()["id"]

        put_resp = await async_client.put(
            f"/api/v1/crm-contacts/{contact_id}",
            json={"first_name": "UpdatedContact", "designation": "VP Engineering"},
            headers=async_auth_headers,
        )
        assert put_resp.status_code == 200
        assert put_resp.json()["first_name"] == "UpdatedContact"

    async def test_update_contact_not_found(self, async_client, async_auth_headers):
        """PUT to a non-existent contact should return 404."""
        resp = await async_client.put(
            "/api/v1/crm-contacts/999999",
            json={"first_name": "Ghost"},
            headers=async_auth_headers,
        )
        assert resp.status_code == 404


# ===========================================================================
# DEALS
# ===========================================================================


@pytest.mark.asyncio
class TestCRMDeals:
    """CRUD tests for /api/v1/crm-deals."""

    async def test_list_deals(self, async_client, async_auth_headers):
        """GET /api/v1/crm-deals should return a paginated response."""
        resp = await async_client.get("/api/v1/crm-deals", headers=async_auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data

    async def test_create_deal(self, async_client, async_auth_headers):
        """POST /api/v1/crm-deals should create a new deal."""
        payload = {
            "title": "Enterprise License Deal",
            "description": "Annual enterprise license for VoiceFlow",
            "value": 500000.0,
            "stage": "discovery",
            "probability": 25.0,
        }
        resp = await async_client.post(
            "/api/v1/crm-deals", json=payload, headers=async_auth_headers,
        )
        assert resp.status_code == 201, f"Create deal failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data["title"] == payload["title"]
        assert float(data["value"]) == 500000.0

    async def test_create_deal_missing_title(self, async_client, async_auth_headers):
        """Creating a deal without title should return 422."""
        resp = await async_client.post("/api/v1/crm-deals", json={
            "value": 100000.0,
        }, headers=async_auth_headers)
        assert resp.status_code == 422

    async def test_get_deal_by_id(self, async_client, async_auth_headers):
        """Create a deal, then GET it by ID."""
        create_resp = await async_client.post("/api/v1/crm-deals", json={
            "title": "Get By ID Deal",
            "value": 250000.0,
        }, headers=async_auth_headers)
        if create_resp.status_code != 201:
            pytest.skip("Could not create deal")
        deal_id = create_resp.json()["id"]

        get_resp = await async_client.get(
            f"/api/v1/crm-deals/{deal_id}", headers=async_auth_headers,
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == deal_id

    async def test_get_deal_not_found(self, async_client, async_auth_headers):
        """GET a non-existent deal should return 404."""
        resp = await async_client.get(
            "/api/v1/crm-deals/999999", headers=async_auth_headers,
        )
        assert resp.status_code == 404

    async def test_update_deal(self, async_client, async_auth_headers):
        """Create a deal, then PUT to update stage and value."""
        create_resp = await async_client.post("/api/v1/crm-deals", json={
            "title": "Update Stage Deal",
            "value": 100000.0,
            "stage": "discovery",
        }, headers=async_auth_headers)
        if create_resp.status_code != 201:
            pytest.skip("Could not create deal")
        deal_id = create_resp.json()["id"]

        put_resp = await async_client.put(
            f"/api/v1/crm-deals/{deal_id}",
            json={"stage": "proposal", "value": 150000.0, "probability": 50.0},
            headers=async_auth_headers,
        )
        assert put_resp.status_code == 200
        updated = put_resp.json()
        assert updated.get("stage") == "proposal"
        assert float(updated.get("value", 0)) == 150000.0

    async def test_update_deal_not_found(self, async_client, async_auth_headers):
        """PUT to a non-existent deal should return 404."""
        resp = await async_client.put(
            "/api/v1/crm-deals/999999",
            json={"title": "Ghost Deal"},
            headers=async_auth_headers,
        )
        assert resp.status_code == 404

    async def test_deal_lifecycle_discovery_to_closed_won(self, async_client, async_auth_headers):
        """Test a deal moving through stages: discovery -> proposal -> negotiation -> closed_won."""
        # Create
        create_resp = await async_client.post("/api/v1/crm-deals", json={
            "title": "Lifecycle Deal",
            "value": 300000.0,
            "stage": "discovery",
        }, headers=async_auth_headers)
        if create_resp.status_code != 201:
            pytest.skip("Could not create deal")
        deal_id = create_resp.json()["id"]

        # Move to proposal
        resp1 = await async_client.put(
            f"/api/v1/crm-deals/{deal_id}",
            json={"stage": "proposal", "probability": 40.0},
            headers=async_auth_headers,
        )
        assert resp1.status_code == 200
        assert resp1.json()["stage"] == "proposal"

        # Move to negotiation
        resp2 = await async_client.put(
            f"/api/v1/crm-deals/{deal_id}",
            json={"stage": "negotiation", "probability": 70.0},
            headers=async_auth_headers,
        )
        assert resp2.status_code == 200
        assert resp2.json()["stage"] == "negotiation"

        # Close as won
        resp3 = await async_client.put(
            f"/api/v1/crm-deals/{deal_id}",
            json={"stage": "closed_won", "probability": 100.0},
            headers=async_auth_headers,
        )
        assert resp3.status_code == 200
        assert resp3.json()["stage"] == "closed_won"


# ===========================================================================
# DASHBOARD
# ===========================================================================


@pytest.mark.asyncio
class TestCRMDashboard:
    """Tests for /api/v1/dashboard."""

    async def test_dashboard_returns_metrics(self, async_client, async_auth_headers):
        """GET /api/v1/dashboard should return CRM metrics."""
        resp = await async_client.get("/api/v1/dashboard", headers=async_auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_leads" in data
        assert "total_deals" in data
        assert "conversion_rate" in data
        assert "pipeline_value" in data

    async def test_dashboard_requires_auth(self, async_client):
        """Dashboard should require authentication."""
        resp = await async_client.get("/api/v1/dashboard")
        assert resp.status_code in (401, 403)
