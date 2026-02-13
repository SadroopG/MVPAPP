"""
Comprehensive Backend API Tests for Expo Intel App
Tests cover: Health, Seed, Auth, Expos, Exhibitors, Shortlists, Expo Days, Admin
"""
import pytest
import requests
import os
import json
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env file to get backend URL
frontend_env = Path(__file__).parent.parent.parent / "frontend" / ".env"
if frontend_env.exists():
    load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    BASE_URL = "https://expo-day-app.preview.emergentagent.com"

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="session")
def demo_user_token(api_client):
    """Get demo user token (assumes seed data exists)"""
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

@pytest.fixture(scope="session")
def admin_user_token(api_client):
    """Get admin user token (assumes seed data exists)"""
    try:
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@expointel.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        return None
    except:
        return None

@pytest.fixture
def auth_headers_demo(demo_user_token):
    """Headers with demo user auth"""
    if demo_user_token:
        return {"Authorization": f"Bearer {demo_user_token}", "Content-Type": "application/json"}
    return {"Content-Type": "application/json"}

@pytest.fixture
def auth_headers_admin(admin_user_token):
    """Headers with admin user auth"""
    if admin_user_token:
        return {"Authorization": f"Bearer {admin_user_token}", "Content-Type": "application/json"}
    return {"Content-Type": "application/json"}

# ============ HEALTH CHECK ============

class TestHealth:
    """Health check endpoint"""
    
    def test_health_check(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ Health check passed")

# ============ SEED DATA ============

class TestSeed:
    """Seed data endpoint"""
    
    def test_seed_data(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/seed")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["seeded", "already_seeded"]
        print(f"✓ Seed endpoint: {data['status']}")

# ============ AUTH ENDPOINTS ============

class TestAuth:
    """Authentication endpoints"""
    
    def test_register_new_user(self, api_client):
        """Register a new test user"""
        test_email = f"TEST_user_{os.urandom(4).hex()}@test.com"
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "name": "Test User"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == test_email
        assert data["user"]["role"] == "user"
        print(f"✓ Register new user: {test_email}")
    
    def test_login_demo_user(self, api_client):
        """Login with demo credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@expointel.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "demo@expointel.com"
        print("✓ Demo login successful")
    
    def test_login_admin_user(self, api_client):
        """Login with admin credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@expointel.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        print("✓ Admin login successful")
    
    def test_login_invalid_credentials(self, api_client):
        """Login with wrong password should fail"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@expointel.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected")
    
    def test_get_me_authenticated(self, api_client, auth_headers_demo):
        """Get current user info with valid token"""
        if not auth_headers_demo.get("Authorization"):
            pytest.skip("Demo user token not available")
        response = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers_demo)
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "role" in data
        print(f"✓ Get me: {data['email']}")
    
    def test_get_me_unauthenticated(self, api_client):
        """Get me without token should fail"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Unauthenticated request correctly rejected")

# ============ EXPOS ============

class TestExpos:
    """Expo endpoints"""
    
    def test_get_expos(self, api_client):
        """Get all expos"""
        response = api_client.get(f"{BASE_URL}/api/expos")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2  # Seed data has 2 expos
        print(f"✓ Get expos: {len(data)} expos found")
    
    def test_create_expo_authenticated(self, api_client, auth_headers_demo):
        """Create new expo with auth"""
        if not auth_headers_demo.get("Authorization"):
            pytest.skip("Demo user token not available")
        response = api_client.post(f"{BASE_URL}/api/expos", 
            headers=auth_headers_demo,
            json={
                "name": "TEST_Expo_Create",
                "date": "2026-12-31",
                "location": "Test City"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Expo_Create"
        assert "id" in data
        print(f"✓ Create expo: {data['id']}")

# ============ EXHIBITORS ============

class TestExhibitors:
    """Exhibitor endpoints"""
    
    def test_get_exhibitors_all(self, api_client):
        """Get all exhibitors"""
        response = api_client.get(f"{BASE_URL}/api/exhibitors")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 8  # Seed data has 8 exhibitors
        print(f"✓ Get all exhibitors: {len(data)} found")
    
    def test_get_exhibitors_by_expo(self, api_client):
        """Get exhibitors filtered by expo"""
        # First get an expo
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        if not expos:
            pytest.skip("No expos available")
        expo_id = expos[0]["id"]
        
        response = api_client.get(f"{BASE_URL}/api/exhibitors?expo_id={expo_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for ex in data:
            assert ex["expo_id"] == expo_id
        print(f"✓ Get exhibitors by expo: {len(data)} found")
    
    def test_get_exhibitor_by_id(self, api_client):
        """Get single exhibitor detail"""
        exhibitors = api_client.get(f"{BASE_URL}/api/exhibitors").json()
        if not exhibitors:
            pytest.skip("No exhibitors available")
        exhibitor_id = exhibitors[0]["id"]
        
        response = api_client.get(f"{BASE_URL}/api/exhibitors/{exhibitor_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == exhibitor_id
        assert "company" in data
        assert "hq" in data
        assert "revenue" in data
        print(f"✓ Get exhibitor detail: {data['company']}")
    
    def test_get_exhibitor_not_found(self, api_client):
        """Get non-existent exhibitor should return 404"""
        response = api_client.get(f"{BASE_URL}/api/exhibitors/nonexistent-id-12345")
        assert response.status_code == 404
        print("✓ Exhibitor 404 handled correctly")
    
    def test_get_filter_options(self, api_client):
        """Get filter options"""
        response = api_client.get(f"{BASE_URL}/api/exhibitors/filters/options")
        assert response.status_code == 200
        data = response.json()
        assert "hqs" in data
        assert "industries" in data
        assert "solutions" in data
        assert isinstance(data["hqs"], list)
        print(f"✓ Filter options: {len(data['industries'])} industries, {len(data['solutions'])} solutions")

# ============ SHORTLISTS ============

class TestShortlists:
    """Shortlist endpoints"""
    
    def test_create_shortlist(self, api_client, auth_headers_demo):
        """Create new shortlist"""
        if not auth_headers_demo.get("Authorization"):
            pytest.skip("Demo user token not available")
        
        # Get an expo first
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        if not expos:
            pytest.skip("No expos available")
        expo_id = expos[0]["id"]
        
        response = api_client.post(f"{BASE_URL}/api/shortlists",
            headers=auth_headers_demo,
            json={"expo_id": expo_id, "name": "TEST_Shortlist_Create"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Shortlist_Create"
        assert data["expo_id"] == expo_id
        assert "id" in data
        print(f"✓ Create shortlist: {data['id']}")
    
    def test_get_shortlists(self, api_client, auth_headers_demo):
        """Get user's shortlists"""
        if not auth_headers_demo.get("Authorization"):
            pytest.skip("Demo user token not available")
        
        response = api_client.get(f"{BASE_URL}/api/shortlists", headers=auth_headers_demo)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get shortlists: {len(data)} found")
    
    def test_add_to_shortlist(self, api_client, auth_headers_demo):
        """Add exhibitor to shortlist"""
        if not auth_headers_demo.get("Authorization"):
            pytest.skip("Demo user token not available")
        
        # Get expo and exhibitor
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        exhibitors = api_client.get(f"{BASE_URL}/api/exhibitors").json()
        if not expos or not exhibitors:
            pytest.skip("No data available")
        
        # Create shortlist
        sl_response = api_client.post(f"{BASE_URL}/api/shortlists",
            headers=auth_headers_demo,
            json={"expo_id": expos[0]["id"], "name": "TEST_SL_Add"}
        )
        shortlist_id = sl_response.json()["id"]
        exhibitor_id = exhibitors[0]["id"]
        
        # Add exhibitor
        response = api_client.post(f"{BASE_URL}/api/shortlists/{shortlist_id}/add",
            headers=auth_headers_demo,
            json={"exhibitor_id": exhibitor_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "added"
        
        # Verify by getting shortlist
        get_response = api_client.get(f"{BASE_URL}/api/shortlists", headers=auth_headers_demo)
        shortlists = get_response.json()
        target_sl = next((sl for sl in shortlists if sl["id"] == shortlist_id), None)
        assert target_sl is not None
        assert exhibitor_id in target_sl["exhibitor_ids"]
        print(f"✓ Add to shortlist verified")
    
    def test_remove_from_shortlist(self, api_client, auth_headers_demo):
        """Remove exhibitor from shortlist"""
        if not auth_headers_demo.get("Authorization"):
            pytest.skip("Demo user token not available")
        
        # Setup: create shortlist with exhibitor
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        exhibitors = api_client.get(f"{BASE_URL}/api/exhibitors").json()
        if not expos or not exhibitors:
            pytest.skip("No data available")
        
        sl_response = api_client.post(f"{BASE_URL}/api/shortlists",
            headers=auth_headers_demo,
            json={"expo_id": expos[0]["id"], "name": "TEST_SL_Remove"}
        )
        shortlist_id = sl_response.json()["id"]
        exhibitor_id = exhibitors[0]["id"]
        
        api_client.post(f"{BASE_URL}/api/shortlists/{shortlist_id}/add",
            headers=auth_headers_demo,
            json={"exhibitor_id": exhibitor_id}
        )
        
        # Remove exhibitor
        response = api_client.post(f"{BASE_URL}/api/shortlists/{shortlist_id}/remove",
            headers=auth_headers_demo,
            json={"exhibitor_id": exhibitor_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "removed"
        print("✓ Remove from shortlist successful")
    
    def test_delete_shortlist(self, api_client, auth_headers_demo):
        """Delete shortlist"""
        if not auth_headers_demo.get("Authorization"):
            pytest.skip("Demo user token not available")
        
        # Create shortlist
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        if not expos:
            pytest.skip("No expos available")
        
        sl_response = api_client.post(f"{BASE_URL}/api/shortlists",
            headers=auth_headers_demo,
            json={"expo_id": expos[0]["id"], "name": "TEST_SL_Delete"}
        )
        shortlist_id = sl_response.json()["id"]
        
        # Delete
        response = api_client.delete(f"{BASE_URL}/api/shortlists/{shortlist_id}",
            headers=auth_headers_demo
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "deleted"
        print("✓ Delete shortlist successful")

# ============ EXPO DAYS ============

class TestExpoDays:
    """Expo Day endpoints"""
    
    def test_create_expoday(self, api_client, auth_headers_demo):
        """Create expo day"""
        if not auth_headers_demo.get("Authorization"):
            pytest.skip("Demo user token not available")
        
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        if not expos:
            pytest.skip("No expos available")
        expo_id = expos[0]["id"]
        
        response = api_client.post(f"{BASE_URL}/api/expodays",
            headers=auth_headers_demo,
            json={"expo_id": expo_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["expo_id"] == expo_id
        assert "id" in data
        assert "meetings" in data
        print(f"✓ Create expo day: {data['id']}")
    
    def test_add_meeting_to_expoday(self, api_client, auth_headers_demo):
        """Add meeting to expo day"""
        if not auth_headers_demo.get("Authorization"):
            pytest.skip("Demo user token not available")
        
        # Get or create expo day
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        exhibitors = api_client.get(f"{BASE_URL}/api/exhibitors").json()
        if not expos or not exhibitors:
            pytest.skip("No data available")
        
        expo_id = expos[0]["id"]
        days_response = api_client.get(f"{BASE_URL}/api/expodays?expo_id={expo_id}", 
            headers=auth_headers_demo)
        days = days_response.json()
        
        if days:
            expoday_id = days[0]["id"]
        else:
            ed_response = api_client.post(f"{BASE_URL}/api/expodays",
                headers=auth_headers_demo,
                json={"expo_id": expo_id}
            )
            expoday_id = ed_response.json()["id"]
        
        exhibitor_id = exhibitors[0]["id"]
        
        # Add meeting
        response = api_client.post(f"{BASE_URL}/api/expodays/{expoday_id}/meetings",
            headers=auth_headers_demo,
            json={
                "exhibitor_id": exhibitor_id,
                "time": "10:30 AM",
                "agenda": "Test meeting agenda"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["exhibitor_id"] == exhibitor_id
        assert data["time"] == "10:30 AM"
        assert "id" in data
        print(f"✓ Add meeting: {data['id']}")
    
    def test_checkin_meeting(self, api_client, auth_headers_demo):
        """Check in to meeting"""
        if not auth_headers_demo.get("Authorization"):
            pytest.skip("Demo user token not available")
        
        # Setup: create expo day and meeting
        expos = api_client.get(f"{BASE_URL}/api/expos").json()
        exhibitors = api_client.get(f"{BASE_URL}/api/exhibitors").json()
        if not expos or not exhibitors:
            pytest.skip("No data available")
        
        expo_id = expos[0]["id"]
        ed_response = api_client.post(f"{BASE_URL}/api/expodays",
            headers=auth_headers_demo,
            json={"expo_id": expo_id}
        )
        expoday_id = ed_response.json()["id"]
        
        meeting_response = api_client.post(f"{BASE_URL}/api/expodays/{expoday_id}/meetings",
            headers=auth_headers_demo,
            json={
                "exhibitor_id": exhibitors[0]["id"],
                "time": "11:00 AM",
                "agenda": "Checkin test"
            }
        )
        meeting_id = meeting_response.json()["id"]
        
        # Check in
        response = api_client.post(f"{BASE_URL}/api/expodays/{expoday_id}/meetings/{meeting_id}/checkin",
            headers=auth_headers_demo
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "checked_in"
        print("✓ Meeting check-in successful")
    
    def test_get_expodays(self, api_client, auth_headers_demo):
        """Get expo days"""
        if not auth_headers_demo.get("Authorization"):
            pytest.skip("Demo user token not available")
        
        response = api_client.get(f"{BASE_URL}/api/expodays", headers=auth_headers_demo)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get expo days: {len(data)} found")

# ============ ADMIN ============

class TestAdmin:
    """Admin endpoints"""
    
    def test_get_users(self, api_client, auth_headers_admin):
        """Get all users (admin only)"""
        if not auth_headers_admin.get("Authorization"):
            pytest.skip("Admin token not available")
        
        response = api_client.get(f"{BASE_URL}/api/admin/users", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2  # At least demo and admin
        print(f"✓ Get users: {len(data)} users found")
