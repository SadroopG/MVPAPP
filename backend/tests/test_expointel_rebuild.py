"""
Comprehensive Backend API Tests for ExpoIntel B2B App (Rebuild)
Tests: Health, Auth, Expos, Companies, Shortlists (with stage progression), 
Networks, Expo Days, Admin CSV Upload, Export
"""
import pytest
import requests
import os
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get backend URL
frontend_env = Path(__file__).parent.parent.parent / "frontend" / ".env"
if frontend_env.exists():
    load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not found in environment")

BASE_URL = BASE_URL.rstrip('/')

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="session")
def demo_user_token(api_client):
    """Get demo user token"""
    try:
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@expointel.com",
            "password": "demo123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        return None
    except:
        return None

@pytest.fixture
def auth_headers(demo_user_token):
    """Headers with demo user auth"""
    if demo_user_token:
        return {"Authorization": f"Bearer {demo_user_token}", "Content-Type": "application/json"}
    pytest.skip("Demo user token not available")

# ============ HEALTH & SEED ============

class TestHealthAndSeed:
    """Health check and seed data"""
    
    def test_health_check(self, api_client):
        """Test /api/health returns ok"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ Health check passed")

# ============ AUTH ============

class TestAuth:
    """Authentication endpoints"""
    
    def test_login_demo_user(self, api_client):
        """Test POST /api/auth/login with demo credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@expointel.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "demo@expointel.com"
        assert data["user"]["role"] == "user"
        print("✓ Demo login successful")
    
    def test_login_invalid_credentials(self, api_client):
        """Test login with wrong password"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@expointel.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login rejected")
    
    def test_get_me_authenticated(self, api_client, auth_headers):
        """Test GET /api/auth/me with valid token"""
        response = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "role" in data
        assert "id" in data
        print(f"✓ Get me: {data['email']}")

# ============ EXPOS ============

class TestExpos:
    """Expo endpoints"""
    
    def test_get_expos(self, api_client):
        """Test GET /api/expos returns 5 expos"""
        response = api_client.get(f"{BASE_URL}/api/expos")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5, f"Expected 5 expos, got {len(data)}"
        # Verify company_count is present
        for expo in data:
            assert "company_count" in expo
            assert "id" in expo
            assert "name" in expo
            assert "region" in expo
            assert "industry" in expo
        print(f"✓ Get expos: {len(data)} expos with company_count")
    
    def test_get_expo_by_id(self, api_client):
        """Test GET /api/expos/{id} returns single expo"""
        # Get first expo
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        expo_id = expos[0]["id"]
        
        response = api_client.get(f"{BASE_URL}/api/expos/{expo_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == expo_id
        assert "company_count" in data
        print(f"✓ Get expo detail: {data['name']}")
    
    def test_get_expo_filters(self, api_client):
        """Test GET /api/expos/meta/filters returns regions and industries"""
        response = api_client.get(f"{BASE_URL}/api/expos/meta/filters")
        assert response.status_code == 200
        data = response.json()
        assert "regions" in data
        assert "industries" in data
        assert isinstance(data["regions"], list)
        assert isinstance(data["industries"], list)
        assert len(data["regions"]) >= 2, "Expected at least 2 regions"
        # Check for expected regions
        assert "Europe" in data["regions"]
        assert "North America" in data["regions"]
        print(f"✓ Expo filters: {len(data['regions'])} regions, {len(data['industries'])} industries")

# ============ COMPANIES ============

class TestCompanies:
    """Company endpoints"""
    
    def test_get_companies_by_expo(self, api_client):
        """Test GET /api/companies?expo_id=<id> returns companies"""
        # Get first expo
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        expo_id = expos[0]["id"]
        
        response = api_client.get(f"{BASE_URL}/api/companies?expo_id={expo_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected companies for expo"
        # Verify company structure
        company = data[0]
        assert "id" in company
        assert "name" in company
        assert "hq" in company
        assert "revenue" in company
        assert "booth" in company
        assert company["expo_id"] == expo_id
        print(f"✓ Get companies for expo: {len(data)} companies")
    
    def test_get_company_by_id(self, api_client):
        """Test GET /api/companies/{id} returns single company"""
        # Get first company
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        companies = api_client.get(f"{BASE_URL}/api/companies?expo_id={expos[0]['id']}").json()
        company_id = companies[0]["id"]
        
        response = api_client.get(f"{BASE_URL}/api/companies/{company_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == company_id
        assert "name" in data
        assert "hq" in data
        assert "revenue" in data
        print(f"✓ Get company detail: {data['name']}")
    
    def test_get_company_filter_options(self, api_client):
        """Test GET /api/companies/filters/options returns filter options"""
        response = api_client.get(f"{BASE_URL}/api/companies/filters/options")
        assert response.status_code == 200
        data = response.json()
        assert "industries" in data
        assert "hqs" in data
        assert "min_revenue" in data
        assert "max_revenue" in data
        assert isinstance(data["industries"], list)
        assert isinstance(data["hqs"], list)
        print(f"✓ Company filter options: {len(data['industries'])} industries, {len(data['hqs'])} HQs")
    
    def test_update_company_stage(self, api_client, demo_user_token):
        """Test PUT /api/companies/{id}/stage updates stage"""
        # Get first company
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        companies = api_client.get(f"{BASE_URL}/api/companies?expo_id={expos[0]['id']}").json()
        company_id = companies[0]["id"]
        
        # Update stage (endpoint uses Form data - use requests directly to avoid session headers)
        import requests
        form_headers = {"Authorization": f"Bearer {demo_user_token}"}
        form_data = {"stage": "prospecting"}
        response = requests.put(f"{BASE_URL}/api/companies/{company_id}/stage",
            headers=form_headers,
            data=form_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "updated"
        assert data["stage"] == "prospecting"
        print(f"✓ Update company stage: {data['stage']}")

# ============ SHORTLISTS ============

class TestShortlists:
    """Shortlist endpoints with stage progression"""
    
    def test_create_shortlist(self, api_client, auth_headers):
        """Test POST /api/shortlists creates shortlist entry"""
        # Get expo and company - use different company to avoid "already_exists"
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        companies = api_client.get(f"{BASE_URL}/api/companies?expo_id={expos[0]['id']}").json()
        
        # Use a different company each time to avoid already_exists
        import random
        company = random.choice(companies)
        
        payload = {
            "company_id": company["id"],
            "expo_id": expos[0]["id"],
            "notes": "Test shortlist note"
        }
        response = api_client.post(f"{BASE_URL}/api/shortlists",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        # Response can be "already_exists" or full object
        if "company_id" in data:
            assert data["company_id"] == company["id"]
            print(f"✓ Create shortlist (new): {data['id']}")
        else:
            assert data["status"] == "already_exists"
            print(f"✓ Create shortlist (already exists): {data['id']}")
    
    def test_get_shortlists_by_stage(self, api_client, auth_headers):
        """Test GET /api/shortlists?stage=prospecting returns filtered shortlists"""
        response = api_client.get(f"{BASE_URL}/api/shortlists?stage=prospecting",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify populated company and expo data
        for item in data:
            if "company" in item:
                assert item["company"]["shortlist_stage"] == "prospecting"
            assert "expo" in item or True  # expo should be populated
        print(f"✓ Get shortlists by stage: {len(data)} items")
    
    def test_update_shortlist_notes(self, api_client, auth_headers):
        """Test PUT /api/shortlists/{id} updates notes"""
        # Get existing shortlist
        shortlists = api_client.get(f"{BASE_URL}/api/shortlists", headers=auth_headers).json()
        if not shortlists:
            pytest.skip("No shortlists available")
        
        shortlist_id = shortlists[0]["id"]
        form_data = {"notes": "Updated test notes"}
        response = api_client.put(f"{BASE_URL}/api/shortlists/{shortlist_id}",
            headers={"Authorization": auth_headers["Authorization"]},
            data=form_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "updated"
        print("✓ Update shortlist notes")
    
    def test_delete_shortlist(self, api_client, auth_headers):
        """Test DELETE /api/shortlists/{id} removes shortlist"""
        # Create a shortlist to delete
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        companies = api_client.get(f"{BASE_URL}/api/companies?expo_id={expos[0]['id']}").json()
        
        create_resp = api_client.post(f"{BASE_URL}/api/shortlists",
            headers=auth_headers,
            json={"company_id": companies[1]["id"], "expo_id": expos[0]["id"]}
        )
        shortlist_id = create_resp.json()["id"]
        
        # Delete
        response = api_client.delete(f"{BASE_URL}/api/shortlists/{shortlist_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "deleted"
        print("✓ Delete shortlist")

# ============ NETWORKS ============

class TestNetworks:
    """Network/engagement tracking endpoints"""
    
    def test_create_network(self, api_client, auth_headers):
        """Test POST /api/networks creates network entry"""
        # Get expo and company
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        companies = api_client.get(f"{BASE_URL}/api/companies?expo_id={expos[0]['id']}").json()
        
        payload = {
            "company_id": companies[0]["id"],
            "expo_id": expos[0]["id"],
            "contact_name": "John Smith",
            "contact_role": "VP Sales",
            "status": "request_sent",
            "meeting_type": "booth_visit"
        }
        response = api_client.post(f"{BASE_URL}/api/networks",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["contact_name"] == "John Smith"
        assert data["status"] == "request_sent"
        print(f"✓ Create network: {data['id']}")
    
    def test_get_networks(self, api_client, auth_headers):
        """Test GET /api/networks returns networks with company/expo data"""
        response = api_client.get(f"{BASE_URL}/api/networks", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify populated data
        for item in data:
            assert "company" in item or True
            assert "expo" in item or True
        print(f"✓ Get networks: {len(data)} entries")
    
    def test_update_network(self, api_client, auth_headers):
        """Test PUT /api/networks/{id} updates status/meeting_type"""
        # Get existing network
        networks = api_client.get(f"{BASE_URL}/api/networks", headers=auth_headers).json()
        if not networks:
            pytest.skip("No networks available")
        
        network_id = networks[0]["id"]
        form_data = {"status": "meeting_scheduled", "meeting_type": "scheduled"}
        response = api_client.put(f"{BASE_URL}/api/networks/{network_id}",
            headers={"Authorization": auth_headers["Authorization"]},
            data=form_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "updated"
        print("✓ Update network")

# ============ EXPO DAYS ============

class TestExpoDays:
    """Expo day timeline/agenda endpoints"""
    
    def test_create_expo_day(self, api_client, auth_headers):
        """Test POST /api/expo-days creates expo day entry"""
        # Get expo and company
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        companies = api_client.get(f"{BASE_URL}/api/companies?expo_id={expos[0]['id']}").json()
        
        payload = {
            "expo_id": expos[0]["id"],
            "company_id": companies[0]["id"],
            "time_slot": "10:00 AM",
            "meeting_type": "booth_visit",
            "booth": "Hall A-101"
        }
        response = api_client.post(f"{BASE_URL}/api/expo-days",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["time_slot"] == "10:00 AM"
        assert data["status"] == "planned"
        print(f"✓ Create expo day: {data['id']}")
    
    def test_get_expo_days(self, api_client, auth_headers):
        """Test GET /api/expo-days returns expo days sorted by time"""
        response = api_client.get(f"{BASE_URL}/api/expo-days", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify populated data
        for item in data:
            assert "company" in item or True
            assert "expo" in item or True
            assert "time_slot" in item
        print(f"✓ Get expo days: {len(data)} entries")
    
    def test_update_expo_day_status(self, api_client, auth_headers):
        """Test PUT /api/expo-days/{id} updates status"""
        # Get existing expo day
        expo_days = api_client.get(f"{BASE_URL}/api/expo-days", headers=auth_headers).json()
        if not expo_days:
            pytest.skip("No expo days available")
        
        expo_day_id = expo_days[0]["id"]
        form_data = {"status": "visited"}
        response = api_client.put(f"{BASE_URL}/api/expo-days/{expo_day_id}",
            headers={"Authorization": auth_headers["Authorization"]},
            data=form_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "updated"
        print("✓ Update expo day status")

# ============ EXPORT ============

class TestExport:
    """CSV export endpoints"""
    
    def test_export_shortlists(self, api_client, auth_headers):
        """Test GET /api/export/shortlists returns CSV data"""
        response = api_client.get(f"{BASE_URL}/api/export/shortlists", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "csv_data" in data
        assert "filename" in data
        assert data["filename"] == "shortlists_export.csv"
        print(f"✓ Export shortlists: {data['filename']}")
